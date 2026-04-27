const { updateRunMeta } = require('../run-helpers');
const { syncTaskBranchFromWorktree } = require('./branch-sync');

async function syncRunAccount(orchestrator, runEntry) {
  try {
    await orchestrator.accountStore.syncAccountFromHost(runEntry?.accountId || null);
    if (runEntry?.accountId) {
      orchestrator.notifyAccountsChanged(runEntry.accountId);
    }
  } catch (error) {
    // Best-effort: keep task finalization resilient to auth sync issues.
  }
}

function shouldAutoReview(result, meta, runEntry) {
  return Boolean(
    !result.stopped &&
    result.code === 0 &&
    meta.autoReview === true &&
    runEntry?.gitFingerprintBefore &&
    runEntry?.gitFingerprintAfter &&
    runEntry.gitFingerprintBefore !== runEntry.gitFingerprintAfter
  );
}

function scheduleAutoReview(orchestrator, taskId, runLabel) {
  orchestrator.runAfterTaskFinalization(taskId, () => {
    void orchestrator.runAutoReviewForTask(taskId, runLabel).catch((error) => {
      const text = `Auto review failed: ${error.message}`;
      const appendFailure = orchestrator.appendRunReviewMessage
        ? orchestrator.appendRunReviewMessage(taskId, runLabel, {
            phase: 'failed',
            automatic: true,
            target: null,
            text
          })
        : orchestrator.appendRunAgentMessage(taskId, runLabel, text);
      void appendFailure.catch(() => {});
      orchestrator.notifyTasksChanged(taskId);
    });
  });
}

function attachFinalizeRunMethod(Orchestrator) {
  Orchestrator.prototype.finalizeRun = async function finalizeRun(taskId, runLabel, result, prompt) {
    const isStopped = () =>
      result.stopped === true || this.getFinalizingTaskRun(taskId)?.stopRequested === true;
    if (isStopped()) {
      result.stopped = true;
    }
    const { meta, usageLimit } = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt,
      now: this.now,
      taskMetaPath: this.taskMetaPath.bind(this),
      runArtifactsDir: this.runArtifactsDir.bind(this),
      isStopped
    });
    await syncTaskBranchFromWorktree(
      this.exec,
      this.taskMetaPath.bind(this),
      taskId,
      meta.worktreePath
    ).catch(() => {});
    const runEntry = meta.runs.find((run) => run.runId === runLabel);
    await syncRunAccount(this, runEntry);
    await this.maybeAutoRotate(taskId, prompt, { ...result, usageLimit, meta });
    if (shouldAutoReview(result, meta, runEntry)) {
      scheduleAutoReview(this, taskId, runLabel);
    }
    this.notifyTasksChanged(taskId);
  };
}

module.exports = {
  attachFinalizeRunMethod
};
