const { ensureDir, readJson, writeJson } = require('../../../shared/filesystem/storage');
const { nextRunLabel, normalizeOptionalString, repoNameFromUrl } = require('../../../orchestrator/utils');
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

function assertTaskCanResume(meta, options) {
  if (!options.allowRunningStatus && (meta.status === 'running' || meta.status === 'stopping')) {
    throw createTaskBusyError();
  }
  if (!meta.threadId) {
    throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
  }
}

async function stopIfTransitionRequested(orchestrator, taskId, meta, claim) {
  if (!claim?.stopRequested) {
    return null;
  }
  return orchestrator.stopPersistedTaskRun(taskId, meta);
}

function attachTaskResumeMethods(Orchestrator) {
  Orchestrator.prototype.resumeTask = async function resumeTask(taskId, prompt, options = {}) {
    const releaseTaskRunTransition =
      options.transitionClaim || this.claimTaskRunTransition(taskId);
    const ownsTaskRunTransition = !options.transitionClaim;
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      await this.init();
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
      assertTaskCanResume(meta, options);
      let replacedContextReposState = null;
      const { hasDockerSocketOverride, shouldUseHostDockerSocket } = resolveDockerUsage(meta, options);
      if (shouldUseHostDockerSocket) {
        await this.awaitStaleTaskRuntimeCleanup(taskId);
      }
      const stoppedAfterCleanup = await stopIfTransitionRequested(this, taskId, meta, transitionClaim);
      if (stoppedAfterCleanup) {
        return stoppedAfterCleanup;
      }
      try {
        const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
        const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
        const hasContextReposOverride = Object.prototype.hasOwnProperty.call(options, 'contextRepos');
        let resolvedContextRepos = contextRepos;
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
        const env = await this.readEnv(meta.envId);
        await this.ensureOwnership(env.mirrorPath);
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
        const stoppedBeforeMetaWrite =
          await stopIfTransitionRequested(this, taskId, meta, transitionClaim);
        if (stoppedBeforeMetaWrite) {
          return stoppedBeforeMetaWrite;
        }
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
        this.markTaskRunTransitionRuntimeActive(transitionClaim);
        await writeJson(this.taskMetaPath(taskId), meta);
        if (transitionClaim?.stopRequested) {
          return this.stopPersistedTaskRun(taskId, meta);
        }
        this.startCodexRunDeferred({
          taskId,
          runLabel,
          prompt,
          codexPrompt,
          cwd: meta.worktreePath,
          appServerConfig: {
            resumeThreadId: meta.threadId,
            model: runModel,
            reasoningEffort: runReasoningEffort,
            developerInstructions: orchestratorInstructions
          },
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
}

module.exports = {
  attachTaskResumeMethods
};
