const { ensureDir, readJson, writeJson } = require('../../storage');
const { buildCodexArgs } = require('../context');
const { nextRunLabel, normalizeOptionalString } = require('../utils');
const { buildRunEntry } = require('./run-entry');
const { cleanupContextRepos } = require('./cleanup');

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

function attachTaskResumeMethods(Orchestrator) {
  Orchestrator.prototype.resumeTask = async function resumeTask(taskId, prompt, options = {}) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.threadId) {
      throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
    }
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
    const hasContextReposOverride = Object.prototype.hasOwnProperty.call(options, 'contextRepos');
    let resolvedContextRepos = contextRepos;
    if (hasContextReposOverride) {
      const contextPlan = await this.prepareContextRepos(taskId, options.contextRepos || []);
      await cleanupContextRepos(this, contextRepos);
      resolvedContextRepos = await this.materializeContextRepos(contextPlan);
      meta.contextRepos = resolvedContextRepos;
    }
    const hasDockerSocketOverride = typeof options.useHostDockerSocket === 'boolean';
    const shouldUseHostDockerSocket = hasDockerSocketOverride
      ? options.useHostDockerSocket
      : Boolean(meta.useHostDockerSocket);
    const dockerSocketPath = shouldUseHostDockerSocket ? this.requireDockerSocket() : null;
    const env = await this.readEnv(meta.envId);
    await this.ensureOwnership(env.mirrorPath);

    const exposedPaths = await this.prepareTaskExposedPaths(taskId, {
      contextRepos: resolvedContextRepos,
      attachments,
      codexHome: this.codexHome
    });

    const runLabel = nextRunLabel(meta.runs.length + 1);
    const hasPrompt = typeof prompt === 'string' && prompt.length > 0;
    const hasCodexPromptOverride = Object.prototype.hasOwnProperty.call(options, 'codexPrompt');
    const codexPrompt = hasCodexPromptOverride ? options.codexPrompt : prompt;
    meta.updatedAt = this.now();
    meta.status = 'running';
    if (hasPrompt) {
      meta.lastPrompt = prompt;
    }
    if (hasDockerSocketOverride) {
      meta.useHostDockerSocket = shouldUseHostDockerSocket;
    }
    const runModel = normalizeOptionalString(options.model) ?? normalizeOptionalString(meta.model);
    const runReasoningEffort =
      normalizeOptionalString(options.reasoningEffort) ??
      normalizeOptionalString(meta.reasoningEffort);
    const activeAccount = await this.accountStore.getActiveAccount();
    meta.runs.push(
      buildRunEntry({
        runLabel,
        prompt,
        model: runModel,
        reasoningEffort: runReasoningEffort,
        now: this.now(),
        account: activeAccount,
        useHostDockerSocket: shouldUseHostDockerSocket
      })
    );

    await ensureDir(this.runArtifactsDir(taskId, runLabel));
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.ensureActiveAuth();
    const args = buildCodexArgs({
      prompt: codexPrompt,
      model: runModel,
      reasoningEffort: runReasoningEffort,
      resumeThreadId: meta.threadId
    });
    const attachmentsDir = this.taskAttachmentsDir(taskId);
    const hasAttachments = attachments.length > 0;
    const readonlyRepoMountMaps = (exposedPaths.contextRepos || [])
      .filter((repo) => repo?.worktreePath && repo?.aliasName)
      .map((repo) => ({ source: repo.worktreePath, target: `/readonly/${repo.aliasName}` }));
    const readonlyAttachmentsMountMaps = hasAttachments
      ? [{ source: attachmentsDir, target: exposedPaths.readonlyAttachmentsPath || '/attachments' }]
      : [];
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: meta.worktreePath,
      args,
      mountPaths: [exposedPaths.homeDir, env.mirrorPath, ...(dockerSocketPath ? [dockerSocketPath] : [])],
      mountPathsRo: [],
      mountMapsRo: [...readonlyRepoMountMaps, ...readonlyAttachmentsMountMaps],
      contextRepos: resolvedContextRepos,
      attachments,
      useHostDockerSocket: shouldUseHostDockerSocket,
      envOverrides: env.envVars,
      envVars: env.envVars,
      homeDir: exposedPaths.homeDir,
      exposedPaths
    });
    return meta;
  };

  Orchestrator.prototype.stopTask = async function stopTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const run = this.running.get(taskId);
    if (!run) {
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
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
    return meta;
  };
}

module.exports = {
  attachTaskResumeMethods
};
