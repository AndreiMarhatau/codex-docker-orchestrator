const { COMMIT_SHA_REGEX, MAX_DIFF_LINES } = require('./constants');

async function resolveRefInRepo(execOrThrow, gitDir, ref) {
  if (!ref) {
    return ref;
  }
  if (ref.startsWith('refs/')) {
    return ref;
  }
  if (ref.startsWith('origin/')) {
    return `refs/remotes/${ref}`;
  }
  if (COMMIT_SHA_REGEX.test(ref)) {
    return ref;
  }
  try {
    await execOrThrow('git', ['--git-dir', gitDir, 'show-ref', '--verify', `refs/tags/${ref}`]);
    return `refs/tags/${ref}`;
  } catch (error) {
    return `refs/remotes/origin/${ref}`;
  }
}

function normalizeDiffPath(aPath, bPath) {
  if (bPath === 'dev/null') {
    return aPath;
  }
  if (aPath === 'dev/null') {
    return bPath;
  }
  return bPath;
}

function parseUnifiedDiff(diffText) {
  if (!diffText) {
    return [];
  }
  const lines = diffText.split('\n');
  const files = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current) {
        const trimmed = current.diff.trimEnd();
        const lineCount = trimmed ? trimmed.split('\n').length : 0;
        files.push({
          ...current,
          lineCount,
          tooLarge: lineCount > MAX_DIFF_LINES
        });
      }
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      const aPath = match ? match[1] : 'unknown';
      const bPath = match ? match[2] : aPath;
      current = {
        path: normalizeDiffPath(aPath, bPath),
        diff: `${line}\n`
      };
      continue;
    }
    if (current) {
      current.diff += `${line}\n`;
    }
  }
  if (current) {
    const trimmed = current.diff.trimEnd();
    const lineCount = trimmed ? trimmed.split('\n').length : 0;
    files.push({
      ...current,
      lineCount,
      tooLarge: lineCount > MAX_DIFF_LINES
    });
  }
  return files;
}

module.exports = {
  resolveRefInRepo,
  parseUnifiedDiff
};
