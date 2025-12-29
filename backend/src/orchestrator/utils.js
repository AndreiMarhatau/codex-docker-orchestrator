function repoNameFromUrl(repoUrl) {
  const trimmed = String(repoUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return 'worktree';
  }
  let pathname = trimmed;
  if (trimmed.includes('://')) {
    try {
      pathname = new URL(trimmed).pathname || trimmed;
    } catch (error) {
      pathname = trimmed;
    }
  } else if (trimmed.includes(':') && !trimmed.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
    pathname = trimmed.split(':').slice(-1)[0];
  }
  const parts = pathname.split(/[\\/]/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) {
    return 'worktree';
  }
  return last.replace(/\.git$/i, '') || 'worktree';
}

function nextRunLabel(runCount) {
  return `run-${String(runCount).padStart(3, '0')}`;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

module.exports = {
  repoNameFromUrl,
  nextRunLabel,
  normalizeOptionalString
};
