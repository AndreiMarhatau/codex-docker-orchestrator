const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { readJson, writeJson, pathExists, removePath } = require('../../storage');
const { isUsageLimitError } = require('../logs');

function shouldRotate({ prompt, result }) {
  if (!prompt) {
    return false;
  }
  if (result.stopped) {
    return false;
  }
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  return result.usageLimit ?? isUsageLimitError(combinedOutput);
}

function hasRemainingUsage(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return false;
  }
  const windows = Object.values(rateLimits).filter(
    (entry) => entry && typeof entry === 'object' && typeof entry.usedPercent === 'number'
  );
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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-account-'));
  try {
    await fs.copyFile(authPath, path.join(tempDir, 'auth.json'));
    return await orchestrator.fetchAccountRateLimitsForHome(tempDir);
  } finally {
    await removePath(tempDir);
  }
}

async function findUsableAccount(orchestrator, accountIds) {
  for (const accountId of accountIds) {
    try {
      const rateLimits = await fetchRateLimitsForAccount(orchestrator, accountId);
      if (hasRemainingUsage(rateLimits)) {
        return accountId;
      }
    } catch {
      // Skip accounts when usage limits cannot be read.
    }
  }
  return null;
}

function attachTaskRotationMethods(Orchestrator) {
  Orchestrator.prototype.maybeAutoRotate = async function maybeAutoRotate(taskId, prompt, result) {
    if (!shouldRotate({ prompt, result })) {
      return;
    }
    const meta = result.meta || (await readJson(this.taskMetaPath(taskId)));
    if (!meta.threadId) {
      return;
    }
    const lastRun = meta.runs?.[meta.runs.length - 1];
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      return;
    }

    if (lastRun && !lastRun.accountId) {
      lastRun.accountId = activeAccount.id;
      lastRun.accountLabel = activeAccount.label || null;
      await writeJson(this.taskMetaPath(taskId), meta);
    }
    if (!lastRun?.accountId || lastRun.accountId !== activeAccount.id) {
      return;
    }

    const accountCount = await this.accountStore.countAccounts();
    if (accountCount < 2) {
      return;
    }
    const maxRotations =
      this.maxAccountRotations === null
        ? Math.max(0, accountCount - 1)
        : this.maxAccountRotations;
    const attempts = meta.autoRotateCount || 0;
    if (attempts >= maxRotations) {
      return;
    }

    const accounts = await this.accountStore.listAccounts();
    const candidateIds = accounts.accounts.slice(1).map((account) => account.id);
    const nextAccountId = await findUsableAccount(this, candidateIds);
    if (!nextAccountId) {
      return;
    }

    await this.accountStore.setActiveAccount(nextAccountId);
    meta.autoRotateCount = attempts + 1;
    meta.updatedAt = this.now();
    meta.status = 'running';
    meta.error = null;
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.resumeTask(taskId, prompt, {
      model: meta.model,
      reasoningEffort: meta.reasoningEffort,
      useHostDockerSocket: meta.useHostDockerSocket
    });
  };
}

module.exports = {
  attachTaskRotationMethods
};
