const { resolveRefInRepo } = require('../../../../shared/git/repository');

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

module.exports = {
  checkoutTaskBranch,
  cleanupFailedWorktree,
  setupWorktree
};
