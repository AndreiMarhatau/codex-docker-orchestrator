const { readJson } = require('../../../../shared/filesystem/storage');
const { beginTaskPush, finishTaskPush } = require('./push-state');

function schedulePushCompletion(orchestrator, options) {
  void options.operation
    .then((result) =>
      finishTaskPush(orchestrator, {
        taskId: options.taskId,
        pushState: options.pushState,
        result,
        transitionClaim: options.transitionClaim,
        failureMessage: options.failureMessage,
        successMessage: options.successMessage
      })
    )
    .catch((error) =>
      finishTaskPush(orchestrator, {
        taskId: options.taskId,
        pushState: options.pushState,
        error,
        transitionClaim: options.transitionClaim,
        failureMessage: options.failureMessage,
        successMessage: options.successMessage
      })
    )
    .finally(() => options.releaseTaskRunTransition());
}

async function prepareAsyncPush(orchestrator, taskId, transitionClaim, message) {
  await orchestrator.init();
  let meta = await readJson(orchestrator.taskMetaPath(taskId));
  meta = await orchestrator.reconcileTaskRuntimeState(taskId, meta);
  orchestrator.markTaskRunTransitionRuntimeActive(transitionClaim);
  return beginTaskPush(orchestrator, taskId, meta, message);
}

function attachStartPushTaskMethod(Orchestrator) {
  Orchestrator.prototype.startPushTask = async function startPushTask(taskId) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    let scheduled = false;
    try {
      const pushState = await prepareAsyncPush(this, taskId, transitionClaim, 'Push started.');
      scheduled = true;
      schedulePushCompletion(this, {
        taskId,
        pushState,
        operation: this.pushTask(taskId, { transitionClaim: releaseTaskRunTransition }),
        transitionClaim,
        releaseTaskRunTransition,
        failureMessage: 'Push failed',
        successMessage: 'Push completed.'
      });
      return { started: true };
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };
}

function attachStartCommitAndPushTaskMethod(Orchestrator) {
  Orchestrator.prototype.startCommitAndPushTask = async function startCommitAndPushTask(
    taskId,
    options = {}
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    let scheduled = false;
    try {
      const pushState = await prepareAsyncPush(this, taskId, transitionClaim, 'Commit & push started.');
      scheduled = true;
      schedulePushCompletion(this, {
        taskId,
        pushState,
        operation: this.commitAndPushTask(taskId, {
          message: options.message,
          transitionClaim: releaseTaskRunTransition
        }),
        transitionClaim,
        releaseTaskRunTransition,
        failureMessage: 'Commit & push failed',
        successMessage: 'Commit & push completed.'
      });
      return { started: true };
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };
}

module.exports = {
  attachStartCommitAndPushTaskMethod,
  attachStartPushTaskMethod
};
