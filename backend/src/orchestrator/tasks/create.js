const crypto = require('node:crypto');
const { ensureDir, writeJson, removePath } = require('../../storage');
const { resolveRefInRepo } = require('../git');
const { buildCodexArgs } = require('../context');
const { nextRunLabel, normalizeOptionalString } = require('../utils');
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

async function checkoutTaskBranch(orch, worktreePath, taskId) {
  const branchName = `codex/${taskId}`;
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

function attachTaskCreateMethods(Orchestrator) {
  Orchestrator.prototype.createTask = async function createTask({
    envId,
    ref,
    prompt,
    fileUploads,
    model,
    reasoningEffort,
    useHostDockerSocket,
    contextRepos
  }) {
    await this.init();
    const env = await this.readEnv(envId);
    await this.ensureOwnership(env.mirrorPath);
    const normalizedModel = normalizeOptionalString(model);
    const normalizedReasoningEffort = normalizeOptionalString(reasoningEffort);
    const taskId = crypto.randomUUID();
    const shouldUseHostDockerSocket = Boolean(useHostDockerSocket);
    const runLabel = nextRunLabel(1);
    let createdWorktreePath = null;
    try {
      await ensureDir(this.taskDir(taskId));
      await ensureDir(this.taskLogsDir(taskId));
      const resolvedContextRepos = await this.resolveContextRepos(taskId, contextRepos);
      const { worktreePath, baseSha, targetRef } = await setupWorktree(this, { env, ref, taskId });
      createdWorktreePath = worktreePath;
      const branchName = await checkoutTaskBranch(this, worktreePath, taskId);
      await ensureDir(this.runArtifactsDir(taskId, runLabel));
      const attachments = await this.prepareTaskAttachments(taskId, fileUploads);
      const exposedPaths = await this.prepareTaskExposedPaths(taskId, {
        contextRepos: resolvedContextRepos,
        attachments,
        codexHome: this.codexHome
      });
      const now = this.now();
      const activeAccount = await this.accountStore.getActiveAccount();
      const meta = buildTaskMeta({
        taskId,
        envId,
        env,
        targetRef,
        baseSha,
        branchName,
        worktreePath,
        contextRepos: resolvedContextRepos,
        attachments,
        model: normalizedModel,
        reasoningEffort: normalizedReasoningEffort,
        useHostDockerSocket: shouldUseHostDockerSocket,
        prompt,
        now,
        account: activeAccount,
        runLabel
      });
      await writeJson(this.taskMetaPath(taskId), meta);
      await this.ensureActiveAuth();
      const args = buildCodexArgs({
        prompt,
        model: normalizedModel,
        reasoningEffort: normalizedReasoningEffort
      });
      const attachmentsDir = this.taskAttachmentsDir(taskId);
      const hasAttachments = attachments.length > 0;
      const readonlyRepoMountMaps = (exposedPaths.contextRepos || [])
        .filter((repo) => repo?.worktreePath && repo?.aliasName)
        .map((repo) => ({ source: repo.worktreePath, target: `/readonly/${repo.aliasName}` }));
      const readonlyAttachmentsMountMaps = hasAttachments
        ? [{ source: attachmentsDir, target: exposedPaths.readonlyAttachmentsPath || '/attachments' }]
        : [];
      this.startCodexRunDeferred({
        taskId,
        runLabel,
        prompt,
        cwd: worktreePath,
        args,
        mountPaths: [exposedPaths.homeDir, env.mirrorPath],
        mountPathsRo: [],
        mountMaps: shouldUseHostDockerSocket ? [this.taskDockerSocketMount(taskId)] : [],
        mountMapsRo: [...readonlyRepoMountMaps, ...readonlyAttachmentsMountMaps],
        contextRepos: resolvedContextRepos,
        attachments,
        useHostDockerSocket: shouldUseHostDockerSocket,
        envOverrides: env.envVars,
        envVars: env.envVars,
        homeDir: exposedPaths.homeDir,
        exposedPaths,
        stopTaskDockerSidecarOnExit: shouldUseHostDockerSocket
      });
      return meta;
    } catch (error) {
      await cleanupFailedWorktree(this, env.mirrorPath, createdWorktreePath);
      await removePath(this.taskDir(taskId));
      throw error;
    }
  };
}
module.exports = {
  attachTaskCreateMethods
};
