const { pathExists, removePath } = require('../../../../shared/filesystem/storage');

async function removeWorktree({ exec, mirrorPath, worktreePath }) {
  const result = await exec('git', [
    '--git-dir',
    mirrorPath,
    'worktree',
    'remove',
    '--force',
    worktreePath
  ]);
  if (result.code !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    const ignorable =
      message.includes('not a working tree') ||
      message.includes('does not exist') ||
      message.includes('No such file or directory');
    if (!ignorable) {
      throw new Error(message || 'Failed to remove worktree');
    }
  }
  if (await pathExists(worktreePath)) {
    await removePath(worktreePath);
  }
  await exec('git', ['--git-dir', mirrorPath, 'worktree', 'prune', '--expire', 'now']);
}

async function cleanupContextRepos(orch, contextRepos) {
  for (const contextRepo of contextRepos) {
    const contextPath = contextRepo?.worktreePath;
    if (!contextPath) {
      continue;
    }
    await orch.ensureOwnership(contextPath);
    let contextEnv = null;
    try {
      contextEnv = await orch.readEnv(contextRepo.envId);
    } catch (error) {
      contextEnv = null;
    }
    if (contextEnv?.mirrorPath) {
      await removeWorktree({
        exec: orch.exec.bind(orch),
        mirrorPath: contextEnv.mirrorPath,
        worktreePath: contextPath
      });
    } else if (await pathExists(contextPath)) {
      await removePath(contextPath);
    }
  }
}

module.exports = {
  cleanupContextRepos,
  removeWorktree
};
