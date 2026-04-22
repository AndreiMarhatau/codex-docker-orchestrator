const { ensureDir, readJson, writeJson } = require('../../storage');
const { buildCodexArgs } = require('../context');
const { nextRunLabel, normalizeOptionalString, repoNameFromUrl } = require('../utils');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('./mounts');
const {
  applyResumeMetaUpdates,
  resolveDockerUsage,
  replaceContextReposForResume,
  rollbackContextRepoReplacement
} = require('./resume-helpers');

function createTaskBusyError() {
  const error = new Error('Wait for the current run to finish before continuing this task.');
  error.code = 'TASK_BUSY';
  return error;
}

function signalRunChild(run, signal) {
  if (!run?.child) {
    return;
  }
  if (
    run.useProcessGroup &&
    Number.isInteger(run.child.pid) &&
    run.child.pid > 0 &&
    process.platform !== 'win32'
  ) {
    try {
      process.kill(-run.child.pid, signal);
      return;
    } catch (error) {
      // Fall back to direct child signal when process-group signaling is unavailable.
    }
  }
  try {
    run.child.kill(signal);
  } catch (error) {
    // Ignore kill errors.
  }
}

function attachStopTaskMethod(Orchestrator) {
  Orchestrator.prototype.stopTask = async function stopTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const run = this.running.get(taskId);
    if (!run) {
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
    if (run.pendingStart && run.startController) {
      run.startController.abort();
    }
    signalRunChild(run, 'SIGTERM');
    run.stopTimeout = setTimeout(() => {
      signalRunChild(run, 'SIGKILL');
    }, 5000);

    const updatedAt = this.now();
    meta.status = 'stopping';
    meta.updatedAt = updatedAt;
    if (meta.runs?.length) {
      meta.runs[meta.runs.length - 1] = {
        ...meta.runs[meta.runs.length - 1],
        status: 'stopping'
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    this.notifyTasksChanged(taskId);
    return meta;
  };
}

function attachTaskResumeMethods(Orchestrator) {
  Orchestrator.prototype.resumeTask = async function resumeTask(taskId, prompt, options = {}) {
    const releaseTaskRunTransition =
      options.transitionClaim || this.claimTaskRunTransition(taskId);
    const ownsTaskRunTransition = !options.transitionClaim;
    try {
      await this.init();
      const meta = await readJson(this.taskMetaPath(taskId));
      if (!options.allowRunningStatus && (meta.status === 'running' || meta.status === 'stopping')) {
        throw createTaskBusyError();
      }
      if (!meta.threadId) {
        throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
      }
      const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
      const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
      const hasContextReposOverride = Object.prototype.hasOwnProperty.call(options, 'contextRepos');
      let resolvedContextRepos = contextRepos;
      let replacedContextReposState = null;
      if (hasContextReposOverride) {
        replacedContextReposState = await replaceContextReposForResume(
          this,
          taskId,
          contextRepos,
          options.contextRepos || []
        );
        resolvedContextRepos = replacedContextReposState.resolvedContextRepos;
        meta.contextRepos = resolvedContextRepos;
      }
      const { hasDockerSocketOverride, shouldUseHostDockerSocket } = resolveDockerUsage(meta, options);
      try {
        const env = await this.readEnv(meta.envId);
        await this.ensureOwnership(env.mirrorPath);
        await this.syncManagedAgents();
        const exposedPaths = await this.prepareTaskExposedPaths(taskId, {
          contextRepos: resolvedContextRepos,
          attachments
        });
        const orchestratorInstructions = this.buildOrchestratorInstructions({
          useHostDockerSocket: shouldUseHostDockerSocket,
          contextRepos: resolvedContextRepos,
          attachments,
          envVars: env.envVars,
          exposedPaths
        });
        const runLabel = nextRunLabel(meta.runs.length + 1);
        const activeAccount = await this.accountStore.getActiveAccount();
        const hasCodexPromptOverride = Object.prototype.hasOwnProperty.call(options, 'codexPrompt');
        const codexPrompt = hasCodexPromptOverride ? options.codexPrompt : prompt;
        const runModel = normalizeOptionalString(options.model) ?? normalizeOptionalString(meta.model);
        const runReasoningEffort =
          normalizeOptionalString(options.reasoningEffort) ?? normalizeOptionalString(meta.reasoningEffort);
        await ensureDir(this.runArtifactsDir(taskId, runLabel));
        await this.ensureActiveAuth();
        const args = buildCodexArgs({
          prompt: codexPrompt,
          model: runModel,
          reasoningEffort: runReasoningEffort,
          developerInstructions: orchestratorInstructions,
          resumeThreadId: meta.threadId
        });
        const workspaceDir = `/workspace/${repoNameFromUrl(meta.repoUrl)}`;
        const volumeMounts = await buildTaskRunVolumeMounts(this, {
          worktreePath: meta.worktreePath,
          workspaceDir,
          mirrorPath: env.mirrorPath,
          attachmentsDir: this.taskAttachmentsDir(taskId),
          hasAttachments: attachments.length > 0,
          contextRepos: exposedPaths.contextRepos || [],
          dockerSocketDir: this.taskDockerSocketDir(taskId),
          useHostDockerSocket: shouldUseHostDockerSocket
        });
        applyResumeMetaUpdates({
          meta,
          prompt,
          hasDockerSocketOverride,
          shouldUseHostDockerSocket,
          now: this.now.bind(this),
          activeAccount,
          runLabel,
          runModel,
          runReasoningEffort
        });
        await writeJson(this.taskMetaPath(taskId), meta);
        this.startCodexRunDeferred({
          taskId,
          runLabel,
          prompt,
          cwd: meta.worktreePath,
          args,
          workspaceDir,
          volumeMounts,
          useHostDockerSocket: shouldUseHostDockerSocket,
          envOverrides: buildTaskRunEnvOverrides(env.envVars, shouldUseHostDockerSocket),
          stopTaskDockerSidecarOnExit: shouldUseHostDockerSocket
        });
        this.notifyTasksChanged(taskId);
        return meta;
      } catch (error) {
        if (replacedContextReposState) {
          meta.contextRepos = await rollbackContextRepoReplacement(
            this,
            taskId,
            replacedContextReposState
          );
        }
        throw error;
      }
    } finally {
      if (ownsTaskRunTransition) {
        releaseTaskRunTransition();
      }
    }
  };
  attachStopTaskMethod(Orchestrator);
}

module.exports = {
  attachTaskResumeMethods
};
