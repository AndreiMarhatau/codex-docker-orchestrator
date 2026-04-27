const { readJson, writeJson } = require('../../../../shared/filesystem/storage');

async function resolveCurrentBranch(exec, worktreePath) {
  const result = await exec('git', ['-C', worktreePath, 'branch', '--show-current']);
  if (result.code !== 0) {
    return null;
  }
  const branchName = result.stdout.trim();
  return branchName || null;
}

async function syncTaskBranchFromWorktree(exec, taskMetaPath, taskId, worktreePath) {
  if (!worktreePath) {
    return;
  }
  const resolvedBranch = await resolveCurrentBranch(exec, worktreePath);
  if (!resolvedBranch) {
    return;
  }
  const meta = await readJson(taskMetaPath(taskId));
  if (meta.branchName === resolvedBranch) {
    return;
  }
  meta.branchName = resolvedBranch;
  await writeJson(taskMetaPath(taskId), meta);
}

module.exports = {
  syncTaskBranchFromWorktree
};
