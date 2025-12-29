const crypto = require('node:crypto');
const { ensureDir, writeJson } = require('../../storage');
const { resolveRefInRepo } = require('../git');
const { buildCodexArgs } = require('../context');
const { nextRunLabel, normalizeOptionalString } = require('../utils');
const { buildRunEntry } = require('./run-entry');

async function setupWorktree(orch, { env, ref, taskId }) {
  const targetRef = ref || env.defaultBranch;
  await orch.execOrThrow('git', [
    '--git-dir',
    env.mirrorPath,
    'fetch',
    'origin',
    '--prune',
    '+refs/heads/*:refs/remotes/origin/*'
  ]);
  const worktreeRef = await resolveRefInRepo(
    orch.execOrThrow.bind(orch),
    env.mirrorPath,
    targetRef
  );
  const baseShaResult = await orch.execOrThrow('git', [
    '--git-dir',
    env.mirrorPath,
    'rev-parse',
    worktreeRef
  ]);
  const baseSha = baseShaResult.stdout.trim() || null;
  const worktreePath = orch.taskWorktree(taskId, env.repoUrl);
  await orch.execOrThrow('git', [
    '--git-dir',
    env.mirrorPath,
    'worktree',
    'add',
    worktreePath,
    worktreeRef
  ]);
  return { worktreePath, baseSha, targetRef };
}

async function checkoutTaskBranch(orch, worktreePath, taskId) {
  const branchName = `codex/${taskId}`;
  await orch.execOrThrow('git', ['-C', worktreePath, 'checkout', '-b', branchName]);
  return branchName;
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
    imagePaths,
    model,
    reasoningEffort,
    useHostDockerSocket,
    contextRepos
  }) {
    await this.init();
    const env = await this.readEnv(envId);
    await this.ensureOwnership(env.mirrorPath);
    const resolvedImagePaths = await this.resolveImagePaths(imagePaths);
    const normalizedModel = normalizeOptionalString(model);
    const normalizedReasoningEffort = normalizeOptionalString(reasoningEffort);
    const shouldUseHostDockerSocket = Boolean(useHostDockerSocket);
    const dockerSocketPath = shouldUseHostDockerSocket ? this.requireDockerSocket() : null;
    const taskId = crypto.randomUUID();
    const runLabel = nextRunLabel(1);

    await ensureDir(this.taskDir(taskId));
    await ensureDir(this.taskLogsDir(taskId));
    const resolvedContextRepos = await this.resolveContextRepos(taskId, contextRepos);

    const { worktreePath, baseSha, targetRef } = await setupWorktree(this, { env, ref, taskId });
    const branchName = await checkoutTaskBranch(this, worktreePath, taskId);

    await ensureDir(this.runArtifactsDir(taskId, runLabel));
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
    const imageArgs = resolvedImagePaths.flatMap((imagePath) => ['--image', imagePath]);
    const args = buildCodexArgs({
      prompt,
      model: normalizedModel,
      reasoningEffort: normalizedReasoningEffort,
      imageArgs
    });
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: worktreePath,
      args,
      mountPaths: [
        env.mirrorPath,
        ...resolvedImagePaths,
        ...(dockerSocketPath ? [dockerSocketPath] : [])
      ],
      mountPathsRo: resolvedContextRepos.map((repo) => repo.worktreePath),
      contextRepos: resolvedContextRepos,
      useHostDockerSocket: shouldUseHostDockerSocket
    });
    return meta;
  };
}

module.exports = {
  attachTaskCreateMethods
};
