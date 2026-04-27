const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathExists, removePath } = require('../../../../shared/filesystem/storage');

function summarizeRateLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return null;
  }
  const getUsedPercent = (window) =>
    window && typeof window.usedPercent === 'number' ? window.usedPercent : null;
  return {
    primaryUsedPercent: getUsedPercent(rateLimits.primary),
    secondaryUsedPercent: getUsedPercent(rateLimits.secondary)
  };
}

function hasRemainingUsage(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return false;
  }
  const windows = Object.values(rateLimits).filter((entry) => entry && typeof entry.usedPercent === 'number');
  return windows.length > 0 && windows.every((entry) => entry.usedPercent < 100);
}

async function persistRefreshedAuth(authPath, codexHome) {
  const refreshedAuthPath = path.join(codexHome, 'auth.json');
  try {
    if (!(await pathExists(refreshedAuthPath))) {
      return;
    }
    const refreshedAuth = await fs.readFile(refreshedAuthPath, 'utf8');
    if (refreshedAuth.trim()) {
      await fs.writeFile(authPath, JSON.stringify(JSON.parse(refreshedAuth), null, 2), { mode: 0o600 });
    }
  } catch {
    // Best-effort: probing usage should remain usable even if auth sync fails.
  }
}

async function cleanupTempDir(orchestrator, tempDir) {
  try {
    await orchestrator.ensureOwnership(tempDir);
    await removePath(tempDir);
  } catch (error) {
    console.log(JSON.stringify({
      event: 'auto-rotate',
      at: orchestrator.now(),
      reason: 'cleanup_failed',
      error: error?.message || String(error)
    }));
  }
}

async function fetchRateLimitsForAccount(orchestrator, accountId) {
  const authPath = orchestrator.accountStore.accountAuthPath(accountId);
  if (!(await pathExists(authPath))) {
    return null;
  }
  const tempRoot = path.join(orchestrator.orchHome || os.tmpdir(), 'tmp');
  await fs.mkdir(tempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(tempRoot, 'codex-account-'));
  const codexHome = path.join(tempDir, '.codex');
  try {
    await fs.mkdir(codexHome, { recursive: true });
    await fs.copyFile(authPath, path.join(codexHome, 'auth.json'));
    await fs.writeFile(path.join(codexHome, 'config.toml'), 'cli_auth_credentials_store = "file"\n');
    const rateLimits = await orchestrator.fetchAccountRateLimitsForHome(codexHome);
    await persistRefreshedAuth(authPath, codexHome);
    return rateLimits;
  } finally {
    await cleanupTempDir(orchestrator, tempDir);
  }
}

async function findUsableAccount(orchestrator, accountIds) {
  const diagnostics = [];
  for (const accountId of accountIds) {
    try {
      const rateLimits = await fetchRateLimitsForAccount(orchestrator, accountId);
      const eligible = hasRemainingUsage(rateLimits);
      diagnostics.push({ accountId, eligible, rateLimits: summarizeRateLimits(rateLimits) });
      if (eligible) {
        return { accountId, diagnostics };
      }
    } catch (error) {
      diagnostics.push({
        accountId,
        eligible: false,
        error: error?.message || 'Unable to read rate limits.'
      });
    }
  }
  return { accountId: null, diagnostics };
}

module.exports = {
  findUsableAccount
};
