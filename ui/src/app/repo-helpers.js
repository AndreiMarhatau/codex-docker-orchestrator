function formatRepoDisplay(repoUrl) {
  if (!repoUrl) {
    return '';
  }
  const trimmed = repoUrl.trim();
  if (!trimmed) {
    return '';
  }
  const cleaned = trimmed.replace(/\.git$/i, '');
  const pickFromPath = (path) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return parts[0] || '';
  };
  if (cleaned.includes('://')) {
    try {
      const url = new URL(cleaned);
      const display = pickFromPath(url.pathname);
      return display || url.hostname;
    } catch (err) {
      return cleaned;
    }
  }
  const sshMatch = cleaned.match(/^[^@]+@[^:]+:(.+)$/);
  if (sshMatch) {
    const display = pickFromPath(sshMatch[1]);
    return display || cleaned;
  }
  const display = pickFromPath(cleaned);
  return display || cleaned;
}

function formatAccountLabel(account) {
  if (!account) {
    return 'unknown';
  }
  return account.label || account.id || 'unknown';
}

function normalizeAccountState(value) {
  if (!value || typeof value !== 'object') {
    return { accounts: [], activeAccountId: null };
  }
  if (!Array.isArray(value.accounts)) {
    return { accounts: [], activeAccountId: null };
  }
  return value;
}

export { formatAccountLabel, formatRepoDisplay, normalizeAccountState };
