/* eslint-disable max-lines */
const crypto = require('node:crypto');
const { ensureDir, readJson, writeJson, removePath } = require('../../storage');
const { resolveRefInRepo } = require('../git');
const { nextRunLabel, normalizeOptionalString, repoNameFromUrl } = require('../utils');
const { fallbackBranchName } = require('./branch-name');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('./mounts');
const { buildRunEntry } = require('./run-entry');
async function setupWorktree(orch, { env, ref, taskId }) {
  const targetRef = ref || env.defaultBranch;
  await orch.execOrThrow('git', ['--git-dir', env.mirrorPath, 'fetch', 'origin', '--prune', '+refs/heads/*:refs/remotes/origin/*']);
  const worktreeRef = await resolveRefInRepo(
    orch.execOrThrow.bind(orch),
    env.mirrorPath,
    targetRef
  );
  const baseShaResult = await orch.execOrThrow('git', ['--git-dir', env.mirrorPath, 'rev-parse', worktreeRef]);
  const baseSha = baseShaResult.stdout.trim() || null;
  const worktreePath = orch.taskWorktree(taskId, env.repoUrl);
  await orch.execOrThrow('git', ['--git-dir', env.mirrorPath, 'worktree', 'add', worktreePath, worktreeRef]);
  return { worktreePath, baseSha, targetRef };
}

async function checkoutTaskBranch(orch, worktreePath, branchName) {
  await orch.execOrThrow('git', ['-C', worktreePath, 'checkout', '-b', branchName]);
  return branchName;
}

async function cleanupFailedWorktree(orch, mirrorPath, worktreePath) {
  if (!mirrorPath || !worktreePath) {
    return;
  }
  await Promise.allSettled([
    orch.exec('git', ['--git-dir', mirrorPath, 'worktree', 'remove', '--force', worktreePath]),
    orch.exec('git', ['--git-dir', mirrorPath, 'worktree', 'prune', '--expire', 'now'])
  ]);
}

function buildTaskMeta({
  taskId,
  envId,
  env,
  targetRef,
  baseSha,
  branchName,
  worktreePath,
  contextRepos,
  attachments,
  model,
  reasoningEffort,
  useHostDockerSocket,
  autoReview,
  prompt,
  now,
  account,
  runLabel
}) {
  return {
    taskId,
    envId,
    repoUrl: env.repoUrl,
    ref: targetRef,
    baseSha,
    branchName,
    worktreePath,
    contextRepos,
    attachments,
    model,
    reasoningEffort,
    useHostDockerSocket,
    autoReview: Boolean(autoReview),
    threadId: null,
    error: null,
    status: 'running',
    initialPrompt: prompt,
    lastPrompt: prompt,
    createdAt: now,
    updatedAt: now,
    runs: [buildRunEntry({
      runLabel,
      prompt,
      model,
      reasoningEffort,
      now,
      account,
      useHostDockerSocket
    })]
  };
}

async function persistInitialTaskMeta(orch, {
  taskId,
  envId,
  env,
  targetRef,
  baseSha,
  worktreePath,
  resolvedContextRepos,
  model,
  reasoningEffort,
  shouldUseHostDockerSocket,
  autoReview,
  prompt,
  runLabel,
  transitionClaim
}) {
  const now = orch.now();
  const activeAccount = await orch.accountStore.getActiveAccount();
  const meta = buildTaskMeta({
    taskId,
    envId,
    env,
    targetRef,
    baseSha,
    branchName: fallbackBranchName(taskId),
    worktreePath,
    contextRepos: resolvedContextRepos,
    attachments: [],
    model,
    reasoningEffort,
    useHostDockerSocket: shouldUseHostDockerSocket,
    autoReview: Boolean(autoReview),
    prompt,
    now,
    account: activeAccount,
    runLabel
  });
  orch.markTaskRunTransitionRuntimeActive(transitionClaim);
  await writeJson(orch.taskMetaPath(taskId), meta);
  return meta;
}

async function generateTaskBranchNameForCreate(orch, {
  taskId,
  prompt,
  env,
  worktreePath,
  workspaceDir,
  runLabel,
  model,
  reasoningEffort
}) {
  const branchVolumeMounts = await buildTaskRunVolumeMounts(orch, {
    worktreePath,
    workspaceDir,
    mirrorPath: env.mirrorPath,
    attachmentsDir: orch.taskAttachmentsDir(taskId),
    hasAttachments: false,
    contextRepos: [],
    dockerSocketDir: orch.taskDockerSocketDir(taskId),
    useHostDockerSocket: false
  });
  const branchName = await orch.generateTaskBranchName({
    taskId,
    prompt,
    cwd: worktreePath,
    workspaceDir,
    volumeMounts: branchVolumeMounts,
    envOverrides: buildTaskRunEnvOverrides(env.envVars, false),
    artifactsDir: orch.runArtifactsDir(taskId, runLabel),
    model,
    reasoningEffort
  });
  return branchName;
}

async function prepareCreateRunContext(orch, {
  taskId,
  env,
  resolvedContextRepos,
  fileUploads,
  meta,
  workspaceDir,
  shouldUseHostDockerSocket
}) {
  const attachments = await orch.prepareTaskAttachments(taskId, fileUploads);
  const exposedPaths = await orch.prepareTaskExposedPaths(taskId, {
    contextRepos: resolvedContextRepos,
    attachments
  });
  const orchestratorInstructions = orch.buildOrchestratorInstructions({
    useHostDockerSocket: shouldUseHostDockerSocket,
    contextRepos: resolvedContextRepos,
    attachments,
    envVars: env.envVars,
    exposedPaths
  });
  meta.attachments = attachments;
  meta.updatedAt = orch.now();
  const volumeMounts = await buildTaskRunVolumeMounts(orch, {
    worktreePath: meta.worktreePath,
    workspaceDir,
    mirrorPath: env.mirrorPath,
    attachmentsDir: orch.taskAttachmentsDir(taskId),
    hasAttachments: attachments.length > 0,
    contextRepos: exposedPaths.contextRepos || [],
    dockerSocketDir: orch.taskDockerSocketDir(taskId),
    useHostDockerSocket: shouldUseHostDockerSocket
  });
  return { orchestratorInstructions, volumeMounts };
}

async function writeStartupPreparedMeta(orch, taskId, meta, claim) {
  if (claim?.stopRequested) {
    return orch.stopPersistedTaskRun(taskId, meta);
  }
  const latest = await readJson(orch.taskMetaPath(taskId));
  if (claim?.stopRequested || latest.status === 'stopped') {
    return orch.stopPersistedTaskRun(taskId, latest);
  }
  const nextMeta = {
    ...latest,
    branchName: meta.branchName,
    attachments: meta.attachments,
    updatedAt: meta.updatedAt
  };
  await writeJson(orch.taskMetaPath(taskId), nextMeta);
  if (claim?.stopRequested) {
    return orch.stopPersistedTaskRun(taskId, nextMeta);
  }
  return nextMeta;
}

async function stopCreatedTaskAfterStartupError(orch, taskId, error, claim) {
  if (!claim?.stopRequested && error?.stopped !== true) {
    return null;
  }
  try {
    const meta = await readJson(orch.taskMetaPath(taskId));
    return orch.stopPersistedTaskRun(taskId, meta);
  } catch (readError) {
    return null;
  }
}

async function finishCreateTaskStartup(orch, {
  taskId,
  env,
  fileUploads,
  prompt,
  meta,
  workspaceDir,
  runLabel,
  normalizedModel,
  normalizedReasoningEffort,
  shouldUseHostDockerSocket,
  resolvedContextRepos,
  preparedRunContext,
  transitionClaim,
  removeTaskOnFailure
}) {
  try {
    await orch.ensureActiveAuth();
    if (transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(taskId, meta);
    }
    const branchName = await generateTaskBranchNameForCreate(orch, {
      taskId,
      prompt,
      env,
      worktreePath: meta.worktreePath,
      workspaceDir,
      runLabel,
      model: normalizedModel,
      reasoningEffort: normalizedReasoningEffort
    });
    if (transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(taskId, meta);
    }
    meta.branchName = await checkoutTaskBranch(orch, meta.worktreePath, branchName);
    if (transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(taskId, meta);
    }
    const { orchestratorInstructions, volumeMounts } = preparedRunContext ||
      (await prepareCreateRunContext(orch, {
        taskId,
        env,
        resolvedContextRepos,
        fileUploads,
        meta,
        workspaceDir,
        shouldUseHostDockerSocket
      }));
    if (transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(taskId, meta);
    }
    meta = await writeStartupPreparedMeta(orch, taskId, meta, transitionClaim);
    orch.startCodexRunDeferred({
      taskId,
      runLabel,
      prompt,
      cwd: meta.worktreePath,
      appServerConfig: {
        model: normalizedModel,
        reasoningEffort: normalizedReasoningEffort,
        developerInstructions: orchestratorInstructions
      },
      workspaceDir,
      volumeMounts,
      useHostDockerSocket: shouldUseHostDockerSocket,
      envOverrides: buildTaskRunEnvOverrides(env.envVars, shouldUseHostDockerSocket),
      stopTaskDockerSidecarOnExit: shouldUseHostDockerSocket,
      transitionClaim
    });
    if (transitionClaim?.stopRequested) {
      return orch.stopPersistedTaskRun(taskId, meta);
    }
    orch.notifyTasksChanged(taskId);
    return meta;
  } catch (error) {
    const stopped = await stopCreatedTaskAfterStartupError(orch, taskId, error, transitionClaim);
    if (stopped) {
      return stopped;
    }
    await cleanupFailedWorktree(orch, env.mirrorPath, meta.worktreePath);
    if (removeTaskOnFailure) {
      await removePath(orch.taskDir(taskId));
      throw error;
    }
    await orch.failRunStart(taskId, runLabel, prompt, error);
    return readJson(orch.taskMetaPath(taskId));
  }
}

function attachTaskCreateMethods(Orchestrator) {
  Orchestrator.prototype.createTask = async function createTask({
    envId,
    ref,
    prompt,
    fileUploads,
    model,
    reasoningEffort,
    useHostDockerSocket,
    autoReview,
    contextRepos,
    deferStartup = false
  }) {
    await this.init();
    const env = await this.readEnv(envId);
    await this.ensureOwnership(env.mirrorPath);
    const normalizedModel = normalizeOptionalString(model);
    const normalizedReasoningEffort = normalizeOptionalString(reasoningEffort);
    const taskId = crypto.randomUUID();
    const shouldUseHostDockerSocket = Boolean(useHostDockerSocket);
    const runLabel = nextRunLabel(1);
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    let createdWorktreePath = null;
    let meta = null;
    let resolvedContextRepos = [];
    try {
      await ensureDir(this.taskDir(taskId));
      await ensureDir(this.taskLogsDir(taskId));
      resolvedContextRepos = await this.resolveContextRepos(taskId, contextRepos);
      const { worktreePath, baseSha, targetRef } = await setupWorktree(this, { env, ref, taskId });
      createdWorktreePath = worktreePath;
      await ensureDir(this.runArtifactsDir(taskId, runLabel));
      meta = await persistInitialTaskMeta(this, {
        taskId,
        envId,
        env,
        targetRef,
        baseSha,
        worktreePath,
        resolvedContextRepos,
        model: normalizedModel,
        reasoningEffort: normalizedReasoningEffort,
        shouldUseHostDockerSocket,
        autoReview: Boolean(autoReview),
        prompt,
        runLabel,
        transitionClaim: releaseTaskRunTransition.claim
      });
    } catch (error) {
      releaseTaskRunTransition();
      await cleanupFailedWorktree(this, env.mirrorPath, createdWorktreePath);
      await removePath(this.taskDir(taskId));
      throw error;
    }
    const workspaceDir = `/workspace/${repoNameFromUrl(env.repoUrl)}`;
    let preparedRunContext = null;
    if (deferStartup) {
      try {
        preparedRunContext = await prepareCreateRunContext(this, {
          taskId,
          env,
          resolvedContextRepos,
          fileUploads,
          meta,
          workspaceDir,
          shouldUseHostDockerSocket
        });
        if (releaseTaskRunTransition.claim?.stopRequested) {
          releaseTaskRunTransition();
          return this.stopPersistedTaskRun(taskId, meta);
        }
        meta = await writeStartupPreparedMeta(this, taskId, meta, releaseTaskRunTransition.claim);
        if (meta.status === 'stopped') {
          releaseTaskRunTransition();
          return meta;
        }
      } catch (error) {
        const stopped = await stopCreatedTaskAfterStartupError(
          this,
          taskId,
          error,
          releaseTaskRunTransition.claim
        );
        releaseTaskRunTransition();
        if (stopped) {
          return stopped;
        }
        await cleanupFailedWorktree(this, env.mirrorPath, createdWorktreePath);
        await removePath(this.taskDir(taskId));
        throw error;
      }
    }
    const startupOptions = {
      taskId,
      env,
      fileUploads,
      prompt,
      meta,
      workspaceDir,
      runLabel,
      normalizedModel,
      normalizedReasoningEffort,
      shouldUseHostDockerSocket,
      resolvedContextRepos,
      preparedRunContext,
      transitionClaim: releaseTaskRunTransition.claim,
      removeTaskOnFailure: !deferStartup
    };
    if (deferStartup) {
      this.notifyTasksChanged(taskId);
      void finishCreateTaskStartup(this, startupOptions)
        .catch(() => {})
        .finally(() => releaseTaskRunTransition());
      return meta;
    }
    try {
      return await finishCreateTaskStartup(this, startupOptions);
    } finally {
      releaseTaskRunTransition();
    }
  };
}
module.exports = {
  attachTaskCreateMethods
};
