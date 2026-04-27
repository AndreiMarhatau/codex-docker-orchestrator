const { readJson, removePath } = require('../../../../shared/filesystem/storage');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('../mounts');
const { checkoutTaskBranch, cleanupFailedWorktree } = require('./worktree');
const { stopCreatedTaskAfterStartupError, writeStartupPreparedMeta } = require('./meta');

async function generateTaskBranchNameForCreate(orch, options) {
  const branchVolumeMounts = await buildTaskRunVolumeMounts(orch, {
    worktreePath: options.worktreePath,
    workspaceDir: options.workspaceDir,
    mirrorPath: options.env.mirrorPath,
    attachmentsDir: orch.taskAttachmentsDir(options.taskId),
    hasAttachments: false,
    contextRepos: [],
    dockerSocketDir: orch.taskDockerSocketDir(options.taskId),
    useHostDockerSocket: false
  });
  return orch.generateTaskBranchName({
    taskId: options.taskId,
    prompt: options.prompt,
    cwd: options.worktreePath,
    workspaceDir: options.workspaceDir,
    volumeMounts: branchVolumeMounts,
    envOverrides: buildTaskRunEnvOverrides(options.env.envVars, false),
    artifactsDir: orch.runArtifactsDir(options.taskId, options.runLabel),
    model: options.model,
    reasoningEffort: options.reasoningEffort
  });
}

async function prepareCreateRunContext(orch, options) {
  const attachments = await orch.prepareTaskAttachments(options.taskId, options.fileUploads);
  const exposedPaths = await orch.prepareTaskExposedPaths(options.taskId, {
    contextRepos: options.resolvedContextRepos,
    attachments
  });
  const orchestratorInstructions = orch.buildOrchestratorInstructions({
    useHostDockerSocket: options.shouldUseHostDockerSocket,
    contextRepos: options.resolvedContextRepos,
    attachments,
    envVars: options.env.envVars,
    exposedPaths
  });
  options.meta.attachments = attachments;
  options.meta.updatedAt = orch.now();
  const volumeMounts = await buildTaskRunVolumeMounts(orch, {
    worktreePath: options.meta.worktreePath,
    workspaceDir: options.workspaceDir,
    mirrorPath: options.env.mirrorPath,
    attachmentsDir: orch.taskAttachmentsDir(options.taskId),
    hasAttachments: attachments.length > 0,
    contextRepos: exposedPaths.contextRepos || [],
    dockerSocketDir: orch.taskDockerSocketDir(options.taskId),
    useHostDockerSocket: options.shouldUseHostDockerSocket
  });
  return { orchestratorInstructions, volumeMounts };
}

async function startPreparedCodexRun(orch, options, meta, preparedRunContext) {
  orch.startCodexRunDeferred({
    taskId: options.taskId,
    runLabel: options.runLabel,
    prompt: options.prompt,
    cwd: meta.worktreePath,
    appServerConfig: {
      model: options.normalizedModel,
      reasoningEffort: options.normalizedReasoningEffort,
      developerInstructions: preparedRunContext.orchestratorInstructions
    },
    workspaceDir: options.workspaceDir,
    volumeMounts: preparedRunContext.volumeMounts,
    useHostDockerSocket: options.shouldUseHostDockerSocket,
    envOverrides: buildTaskRunEnvOverrides(
      options.env.envVars,
      options.shouldUseHostDockerSocket
    ),
    stopTaskDockerSidecarOnExit: options.shouldUseHostDockerSocket,
    transitionClaim: options.transitionClaim
  });
}

async function prepareBranchAndRunContext(orch, options, meta) {
  const branchName = await generateTaskBranchNameForCreate(orch, {
    ...options,
    worktreePath: meta.worktreePath,
    model: options.normalizedModel,
    reasoningEffort: options.normalizedReasoningEffort
  });
  if (options.transitionClaim?.stopRequested) {
    return { stopped: true, meta: await orch.stopPersistedTaskRun(options.taskId, meta) };
  }
  meta.branchName = await checkoutTaskBranch(orch, meta.worktreePath, branchName);
  if (options.transitionClaim?.stopRequested) {
    return { stopped: true, meta: await orch.stopPersistedTaskRun(options.taskId, meta) };
  }
  const preparedRunContext = options.preparedRunContext ||
    (await prepareCreateRunContext(orch, { ...options, meta }));
  return { stopped: false, meta, preparedRunContext };
}

async function finishCreateTaskStartup(orch, options) {
  let meta = options.meta;
  try {
    await orch.ensureActiveAuth();
    if (options.transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(options.taskId, meta);
    }
    const prepared = await prepareBranchAndRunContext(orch, options, meta);
    if (prepared.stopped) {
      return prepared.meta;
    }
    meta = await writeStartupPreparedMeta(orch, options.taskId, prepared.meta, options.transitionClaim);
    startPreparedCodexRun(orch, options, meta, prepared.preparedRunContext);
    if (options.transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(options.taskId, meta);
    }
    orch.notifyTasksChanged(options.taskId);
    return meta;
  } catch (error) {
    const stopped = await stopCreatedTaskAfterStartupError(
      orch,
      options.taskId,
      error,
      options.transitionClaim
    );
    if (stopped) {
      return stopped;
    }
    await cleanupFailedWorktree(orch, options.env.mirrorPath, meta.worktreePath);
    if (options.removeTaskOnFailure) {
      await removePath(orch.taskDir(options.taskId));
      throw error;
    }
    await orch.failRunStart(options.taskId, options.runLabel, options.prompt, error);
    return readJson(orch.taskMetaPath(options.taskId));
  }
}

module.exports = {
  finishCreateTaskStartup,
  prepareCreateRunContext
};
