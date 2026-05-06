function parseNumstat(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    const [addRaw, delRaw] = line.split('\t');
    const add = Number(addRaw);
    const del = Number(delRaw);
    if (!Number.isNaN(add)) {
      additions += add;
    }
    if (!Number.isNaN(del)) {
      deletions += del;
    }
  }
  return { additions, deletions };
}

function combineDiffStats(left, right) {
  return {
    additions: (left?.additions || 0) + (right?.additions || 0),
    deletions: (left?.deletions || 0) + (right?.deletions || 0)
  };
}

async function readUntrackedFiles(exec, worktreePath) {
  const result = await exec('git', [
    '-C',
    worktreePath,
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z'
  ]);
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.split('\0').filter(Boolean);
}

async function readUntrackedDiff(exec, worktreePath, filePath, extraArgs = []) {
  const result = await exec('git', [
    '-C',
    worktreePath,
    'diff',
    ...extraArgs,
    '--no-index',
    '--',
    '/dev/null',
    filePath
  ]);
  if (result.code !== 0 && result.code !== 1) {
    return null;
  }
  return result.stdout;
}

async function readUntrackedDiffStats(exec, worktreePath, untrackedFiles) {
  let stats = { additions: 0, deletions: 0 };
  for (const filePath of untrackedFiles) {
    const stdout = await readUntrackedDiff(exec, worktreePath, filePath, ['--numstat']);
    if (stdout === null) {
      return null;
    }
    stats = combineDiffStats(stats, parseNumstat(stdout));
  }
  return stats;
}

async function readDiffStats(exec, worktreePath, baseSha) {
  if (!baseSha) {
    return null;
  }
  const diffResult = await exec('git', [
    '-C',
    worktreePath,
    'diff',
    '--numstat',
    baseSha,
    '--'
  ]);
  if (diffResult.code !== 0) {
    return null;
  }
  const untrackedFiles = await readUntrackedFiles(exec, worktreePath);
  if (untrackedFiles === null) {
    return null;
  }
  const untrackedStats = await readUntrackedDiffStats(exec, worktreePath, untrackedFiles);
  if (untrackedStats === null) {
    return null;
  }
  return combineDiffStats(parseNumstat(diffResult.stdout), untrackedStats);
}

async function readFullTaskDiff(exec, worktreePath, baseSha) {
  const diffResult = await exec('git', [
    '-C',
    worktreePath,
    'diff',
    '--no-color',
    baseSha,
    '--'
  ]);
  if (diffResult.code !== 0) {
    throw new Error(diffResult.stderr || diffResult.stdout || 'Unable to generate diff.');
  }
  const untrackedFiles = await readUntrackedFiles(exec, worktreePath);
  if (untrackedFiles === null) {
    throw new Error('Unable to list untracked files.');
  }
  let diffText = diffResult.stdout;
  for (const filePath of untrackedFiles) {
    const untrackedDiff = await readUntrackedDiff(exec, worktreePath, filePath, ['--no-color']);
    if (untrackedDiff === null) {
      throw new Error(`Unable to generate diff for untracked file ${filePath}.`);
    }
    diffText += diffText && !diffText.endsWith('\n') ? '\n' : '';
    diffText += untrackedDiff;
  }
  return diffText;
}

module.exports = {
  readDiffStats,
  readFullTaskDiff
};
