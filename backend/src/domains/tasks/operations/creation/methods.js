const crypto = require('node:crypto');
const { ensureDir, removePath } = require('../../../../shared/filesystem/storage');
const { nextRunLabel, normalizeOptionalString, repoNameFromUrl } = require('../../../../orchestrator/utils');
const { persistInitialTaskMeta, stopCreatedTaskAfterStartupError, writeStartupPreparedMeta } = require('./meta');
const { cleanupFailedWorktree, setupWorktree } = require('./worktree');
const { finishCreateTaskStartup, prepareCreateRunContext } = require('./runtime');

function normalizeCreateTaskOptions(options) {
  return {
    normalizedModel: normalizeOptionalString(options.model),
    normalizedReasoningEffort: normalizeOptionalString(options.reasoningEffort),
    shouldUseHostDockerSocket: Boolean(options.useHostDockerSocket),
    runLabel: nextRunLabel(1)
  };
}

async function createInitialTaskFiles(orch, options) {
  await ensureDir(orch.taskDir(options.taskId));
  await ensureDir(orch.taskLogsDir(options.taskId));
  const resolvedContextRepos = await orch.resolveContextRepos(options.taskId, options.contextRepos);
  const worktree = await setupWorktree(orch, {
    env: options.env,
    ref: options.ref,
    taskId: options.taskId
  });
  options.creationState.createdWorktreePath = worktree.worktreePath;
  await ensureDir(orch.runArtifactsDir(options.taskId, options.runLabel));
  const meta = await persistInitialTaskMeta(orch, {
    ...options,
    ...worktree,
    model: options.normalizedModel,
    reasoningEffort: options.normalizedReasoningEffort,
    resolvedContextRepos,
    transitionClaim: options.releaseTaskRunTransition.claim
  });
  return { createdWorktreePath: worktree.worktreePath, meta, resolvedContextRepos };
}

async function prepareDeferredStartup(orch, options) {
  const preparedRunContext = await prepareCreateRunContext(orch, options);
  const claim = options.releaseTaskRunTransition.claim;
  if (claim?.stopRequested) {
    options.releaseTaskRunTransition();
    return { meta: await orch.stopPersistedTaskRun(options.taskId, options.meta), stopped: true };
  }
  const meta = await writeStartupPreparedMeta(orch, options.taskId, options.meta, claim);
  if (meta.status === 'stopped') {
    options.releaseTaskRunTransition();
    return { meta, stopped: true };
  }
  return { meta, preparedRunContext, stopped: false };
}

async function handleDeferredPreparationError(orch, options, error) {
  const stopped = await stopCreatedTaskAfterStartupError(
    orch,
    options.taskId,
    error,
    options.releaseTaskRunTransition.claim
  );
  options.releaseTaskRunTransition();
  if (stopped) {
    return stopped;
  }
  await cleanupFailedWorktree(orch, options.env.mirrorPath, options.createdWorktreePath);
  await removePath(orch.taskDir(options.taskId));
  throw error;
}

function buildStartupOptions(base, preparedRunContext) {
  return {
    taskId: base.taskId,
    env: base.env,
    fileUploads: base.fileUploads,
    prompt: base.prompt,
    meta: base.meta,
    workspaceDir: base.workspaceDir,
    runLabel: base.runLabel,
    normalizedModel: base.normalizedModel,
    normalizedReasoningEffort: base.normalizedReasoningEffort,
    goalObjective: base.goalObjective,
    shouldUseHostDockerSocket: base.shouldUseHostDockerSocket,
    resolvedContextRepos: base.resolvedContextRepos,
    preparedRunContext,
    transitionClaim: base.releaseTaskRunTransition.claim,
    removeTaskOnFailure: !base.deferStartup
  };
}

async function runStartup(orch, options, preparedRunContext) {
  const startupOptions = buildStartupOptions(options, preparedRunContext);
  if (options.deferStartup) {
    orch.notifyTasksChanged(options.taskId);
    void finishCreateTaskStartup(orch, startupOptions)
      .catch(() => {})
      .finally(() => options.releaseTaskRunTransition());
    return options.meta;
  }
  try {
    return await finishCreateTaskStartup(orch, startupOptions);
  } finally {
    options.releaseTaskRunTransition();
  }
}

function attachTaskCreateMethods(Orchestrator) {
  Orchestrator.prototype.createTask = async function createTask(options) {
    await this.init();
    const env = await this.readEnv(options.envId);
    await this.ensureOwnership(env.mirrorPath);
    const normalized = normalizeCreateTaskOptions(options);
    const taskId = crypto.randomUUID();
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const creationState = { createdWorktreePath: null };
    let created = null;
    try {
      created = await createInitialTaskFiles(this, {
        ...options,
        ...normalized,
        env,
        taskId,
        creationState,
        releaseTaskRunTransition
      });
    } catch (error) {
      releaseTaskRunTransition();
      await cleanupFailedWorktree(
        this,
        env.mirrorPath,
        created?.createdWorktreePath || creationState.createdWorktreePath
      );
      await removePath(this.taskDir(taskId));
      throw error;
    }
    const workspaceDir = `/workspace/${repoNameFromUrl(env.repoUrl)}`;
    const base = { ...options, ...normalized, ...created, env, taskId, workspaceDir, releaseTaskRunTransition };
    if (options.deferStartup) {
      try {
        const prepared = await prepareDeferredStartup(this, base);
        if (prepared.stopped) {
          return prepared.meta;
        }
        base.meta = prepared.meta;
        return runStartup(this, base, prepared.preparedRunContext);
      } catch (error) {
        return handleDeferredPreparationError(this, base, error);
      }
    }
    return runStartup(this, base, null);
  };
}

module.exports = {
  attachTaskCreateMethods
};
