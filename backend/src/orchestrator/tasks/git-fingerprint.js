const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function readGitOutput(exec, worktreePath, args) {
  const result = await exec('git', ['-C', worktreePath, ...args]);
  if (result.code !== 0) {
    return null;
  }
  return result.stdout || '';
}

async function hashUntrackedFiles(exec, worktreePath) {
  const output = await readGitOutput(exec, worktreePath, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z'
  ]);
  if (output === null) {
    return null;
  }
  const entries = output.split('\0').filter(Boolean).sort();
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(worktreePath, entry);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.readFile(filePath);
      files.push({
        path: entry,
        hash: crypto.createHash('sha256').update(content).digest('hex')
      });
    } catch {
      files.push({ path: entry, hash: null });
    }
  }
  return files;
}

async function computeGitFingerprint(exec, worktreePath) {
  if (!worktreePath) {
    return null;
  }
  const [head, status, unstagedDiff, stagedDiff, untrackedFiles] = await Promise.all([
    readGitOutput(exec, worktreePath, ['rev-parse', 'HEAD']),
    readGitOutput(exec, worktreePath, ['status', '--porcelain=v1', '-z']),
    readGitOutput(exec, worktreePath, ['diff', '--binary', 'HEAD', '--']),
    readGitOutput(exec, worktreePath, ['diff', '--cached', '--binary', 'HEAD', '--']),
    hashUntrackedFiles(exec, worktreePath)
  ]);
  if (
    head === null ||
    status === null ||
    unstagedDiff === null ||
    stagedDiff === null ||
    untrackedFiles === null
  ) {
    return null;
  }
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      head: head.trim(),
      status,
      unstagedDiff,
      stagedDiff,
      untrackedFiles
    }))
    .digest('hex');
}

module.exports = {
  computeGitFingerprint
};
