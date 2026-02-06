const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { readJson, writeJson, pathExists, removePath } = require('../../storage');
const { isUsageLimitError } = require('../logs');

function shouldRotate({ prompt, result }) {
  return Boolean(
    prompt && !result.stopped && result.code !== 0 && (result.usageLimit ?? isUsageLimitError(result.stdout))
  );
}

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
  if (windows.length === 0) {
    return false;
  }
  return windows.every((entry) => entry.usedPercent < 100);
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
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      'cli_auth_credentials_store = "file"\n'
    );
    const rateLimits = await orchestrator.fetchAccountRateLimitsForHome(codexHome);
    const refreshedAuthPath = path.join(codexHome, 'auth.json');
    try {
      if (await pathExists(refreshedAuthPath)) {
        const refreshedAuth = await fs.readFile(refreshedAuthPath, 'utf8');
        if (refreshedAuth.trim()) {
          const parsedAuth = JSON.parse(refreshedAuth);
          await fs.writeFile(authPath, JSON.stringify(parsedAuth, null, 2), { mode: 0o600 });
        }
      }
    } catch {
      // Best-effort: probing usage should remain usable even if auth sync fails.
    }
    return rateLimits;
  } finally {
    try {
      await orchestrator.ensureOwnership(tempDir);
      await removePath(tempDir);
    } catch (error) {
      // Best-effort cleanup; permission errors shouldn't block rotation.
      try {
        console.log(
          JSON.stringify({
            event: 'auto-rotate',
            at: orchestrator.now(),
            reason: 'cleanup_failed',
            error: error?.message || String(error)
          })
        );
      } catch {
        // Ignore logging failures.
      }
    }
  }
}

async function findUsableAccount(orchestrator, accountIds) {
  const diagnostics = [];
  for (const accountId of accountIds) {
    try {
      const rateLimits = await fetchRateLimitsForAccount(orchestrator, accountId);
      const eligible = hasRemainingUsage(rateLimits);
      diagnostics.push({
        accountId,
        eligible,
        rateLimits: summarizeRateLimits(rateLimits)
      });
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

function logAutoRotate(orchestrator, payload) {
  try {
    console.log(JSON.stringify({ event: 'auto-rotate', at: orchestrator.now(), ...payload }));
  } catch {
    // Avoid throwing during rotation flow.
  }
}

function attachTaskRotationMethods(Orchestrator) {
  Orchestrator.prototype.maybeAutoRotate = async function maybeAutoRotate(taskId, prompt, result) {
    if (!shouldRotate({ prompt, result })) {
      return;
    }
    const meta = result.meta || (await readJson(this.taskMetaPath(taskId)));
    if (!meta.threadId) {
      logAutoRotate(this, { taskId, reason: 'missing_thread_id' });
      return;
    }
    const lastRun = meta.runs?.[meta.runs.length - 1];
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      logAutoRotate(this, { taskId, reason: 'no_active_account' });
      return;
    }

    if (lastRun && !lastRun.accountId) {
      lastRun.accountId = activeAccount.id;
      lastRun.accountLabel = activeAccount.label || null;
      await writeJson(this.taskMetaPath(taskId), meta);
    }
    if (!lastRun?.accountId || lastRun.accountId !== activeAccount.id) {
      logAutoRotate(this, {
        taskId,
        reason: 'active_account_mismatch',
        lastRunAccountId: lastRun?.accountId || null,
        activeAccountId: activeAccount.id
      });
      return;
    }

    const accountCount = await this.accountStore.countAccounts();
    if (accountCount < 2) {
      logAutoRotate(this, {
        taskId,
        reason: 'insufficient_accounts',
        accountCount
      });
      return;
    }
    const maxRotations =
      this.maxAccountRotations === null
        ? Math.max(0, accountCount - 1)
        : this.maxAccountRotations;
    const attempts = meta.autoRotateCount || 0;
    if (attempts >= maxRotations) {
      logAutoRotate(this, {
        taskId,
        reason: 'rotation_limit_reached',
        attempts,
        maxRotations
      });
      return;
    }

    const accounts = await this.accountStore.listAccounts();
    const candidateIds = accounts.accounts.slice(1).map((account) => account.id);
    const { accountId: nextAccountId, diagnostics } = await findUsableAccount(this, candidateIds);
    if (!nextAccountId) {
      logAutoRotate(this, {
        taskId,
        reason: 'no_eligible_account',
        candidateIds,
        diagnostics
      });
      return;
    }

    await this.accountStore.setActiveAccount(nextAccountId);
    logAutoRotate(this, {
      taskId,
      reason: 'rotated',
      fromAccountId: activeAccount.id,
      toAccountId: nextAccountId
    });
    meta.autoRotateCount = attempts + 1;
    meta.updatedAt = this.now();
    meta.status = 'running';
    meta.error = null;
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.resumeTask(taskId, prompt, {
      model: meta.model,
      reasoningEffort: meta.reasoningEffort,
      useHostDockerSocket: meta.useHostDockerSocket,
      codexPrompt: ''
    });
  };
}

module.exports = {
  attachTaskRotationMethods
};
