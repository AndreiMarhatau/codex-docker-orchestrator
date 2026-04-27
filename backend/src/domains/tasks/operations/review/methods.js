const { appendRunAgentMessage, appendRunReviewMessage } = require('./log');
const { appendReviewFailure } = require('./state');
const {
  executeAutoReviewContext,
  executeManualReviewContext,
  prepareAutoReviewContext,
  prepareManualReviewContext
} = require('./context');

function attachReviewLogMethods(Orchestrator) {
  Orchestrator.prototype.appendRunAgentMessage = async function appendRunAgentMessageMethod(
    taskId,
    runLabel,
    text
  ) {
    await appendRunAgentMessage(this, taskId, runLabel, text);
  };

  Orchestrator.prototype.appendRunReviewMessage = async function appendRunReviewMessageMethod(
    taskId,
    runLabel,
    options
  ) {
    await appendRunReviewMessage(this, taskId, runLabel, options);
  };
}

function scheduleManualReview(orchestrator, taskId, transition, context) {
  const execute = async () => {
    return executeManualReviewContext(orchestrator, {
      taskId,
      transitionClaim: transition.claim,
      ...context
    });
  };
  void execute()
    .catch((error) =>
      appendReviewFailure(orchestrator, {
        taskId,
        runLabel: context.latestRun.runId,
        automatic: false,
        error
      }).catch(() => {})
    )
    .finally(() => transition.release());
}

function attachManualReviewMethod(Orchestrator) {
  Orchestrator.prototype.runTaskReview = async function runTaskReview(
    taskId,
    targetInput,
    options = {}
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transition = {
      claim: releaseTaskRunTransition.claim,
      release: releaseTaskRunTransition
    };
    let scheduled = false;
    try {
      const context = await prepareManualReviewContext(this, {
        taskId,
        targetInput,
        transitionClaim: transition.claim
      });
      if (options.defer === true) {
        scheduled = true;
        scheduleManualReview(this, taskId, transition, context);
        return { started: true, target: context.target };
      }
      return await executeManualReviewContext(this, {
        taskId,
        transitionClaim: transition.claim,
        ...context
      });
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };

  Orchestrator.prototype.startTaskReview = async function startTaskReview(taskId, targetInput) {
    return this.runTaskReview(taskId, targetInput, { defer: true });
  };
}

function attachAutoReviewMethod(Orchestrator) {
  Orchestrator.prototype.runAutoReviewForTask = async function runAutoReviewForTask(
    taskId,
    runLabel
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      const context = await prepareAutoReviewContext(this, { taskId, runLabel, transitionClaim });
      if (!context) {
        return null;
      }
      return await executeAutoReviewContext(this, {
        taskId,
        runLabel,
        releaseTaskRunTransition,
        transitionClaim,
        ...context
      });
    } finally {
      releaseTaskRunTransition();
    }
  };
}

function attachTaskReviewMethods(Orchestrator) {
  attachReviewLogMethods(Orchestrator);
  attachManualReviewMethod(Orchestrator);
  attachAutoReviewMethod(Orchestrator);
}

module.exports = {
  attachTaskReviewMethods
};
