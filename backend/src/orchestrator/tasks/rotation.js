const { readJson, writeJson } = require('../../storage');
const { isUsageLimitError } = require('../logs');

function shouldRotate({ prompt, result }) {
  if (!prompt) {
    return false;
  }
  if (result.stopped) {
    return false;
  }
  if (result.code === 0) {
    return false;
  }
  return result.usageLimit ?? isUsageLimitError(result.stdout);
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

    await this.accountStore.rotateActiveAccount();
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
