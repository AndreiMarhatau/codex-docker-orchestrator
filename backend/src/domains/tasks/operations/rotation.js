const { readJson, writeJson } = require('../../../shared/filesystem/storage');
const { isUsageLimitError } = require('../../../orchestrator/logs');
const { findUsableAccount } = require('./rotation/rate-limits');

function shouldRotate({ prompt, result }) {
  return Boolean(
    prompt && !result.stopped && result.code !== 0 && (result.usageLimit ?? isUsageLimitError(result.stdout))
  );
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
    this.notifyAccountsChanged(nextAccountId);
    logAutoRotate(this, {
      taskId,
      reason: 'rotated',
      fromAccountId: activeAccount.id,
      toAccountId: nextAccountId
    });
    const startRotatedResume = async () => {
      meta.autoRotateCount = attempts + 1;
      meta.updatedAt = this.now();
      await writeJson(this.taskMetaPath(taskId), meta);
      await this.resumeTask(taskId, prompt, {
        model: meta.model,
        reasoningEffort: meta.reasoningEffort,
        useHostDockerSocket: meta.useHostDockerSocket,
        codexPrompt: ''
      });
    };
    if (this.runAfterTaskFinalization?.(taskId, startRotatedResume)) { return; }
    await startRotatedResume();
  };
}

module.exports = { attachTaskRotationMethods };
