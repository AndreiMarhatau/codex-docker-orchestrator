const { readJson } = require('../../../../shared/filesystem/storage');
const { normalizeReviewTarget } = require('./target');
const { assertTaskMutationNotStopped } = require('./errors');
const { beginTaskReview, restoreTaskAfterReview } = require('./state');
const { buildAutoReviewFixPrompt, executeTaskReview } = require('./runtime');

async function prepareManualReviewContext(orchestrator, options) {
  await orchestrator.init();
  let meta = await readJson(orchestrator.taskMetaPath(options.taskId));
  meta = await orchestrator.reconcileTaskRuntimeState(options.taskId, meta);
  if (!meta.threadId) {
    throw new Error('Cannot review task without a Codex thread.');
  }
  const target = normalizeReviewTarget(options.targetInput);
  const latestRun = meta.runs?.[meta.runs.length - 1] || null;
  if (!latestRun) {
    throw new Error('Cannot review task without a run.');
  }
  orchestrator.markTaskRunTransitionRuntimeActive(options.transitionClaim);
  const reviewState = await beginTaskReview(orchestrator, {
    taskId: options.taskId,
    meta,
    latestRun,
    target,
    automatic: false
  });
  return { latestRun, meta, reviewState, target };
}

async function executeManualReviewContext(orchestrator, options) {
  try {
    return await executeTaskReview(orchestrator, {
      taskId: options.taskId,
      meta: options.meta,
      target: options.target,
      runLabel: options.latestRun.runId,
      automatic: false,
      transitionClaim: options.transitionClaim
    });
  } finally {
    await restoreTaskAfterReview(
      orchestrator,
      options.taskId,
      options.reviewState,
      options.transitionClaim
    );
  }
}

async function prepareAutoReviewContext(orchestrator, options) {
  await orchestrator.init();
  let meta = await readJson(orchestrator.taskMetaPath(options.taskId));
  meta = await orchestrator.reconcileTaskRuntimeState(options.taskId, meta);
  if (meta.status !== 'completed' || !meta.threadId) {
    return null;
  }
  const gitStatus = await orchestrator.getTaskGitStatus(meta);
  if (gitStatus?.dirty !== true) {
    return null;
  }
  const target = { type: 'uncommittedChanges' };
  const latestRun = meta.runs?.find((run) => run.runId === options.runLabel) ||
    meta.runs?.[meta.runs.length - 1] ||
    null;
  if (!latestRun) {
    return null;
  }
  orchestrator.markTaskRunTransitionRuntimeActive(options.transitionClaim);
  const reviewState = await beginTaskReview(orchestrator, {
    taskId: options.taskId,
    meta,
    latestRun,
    target,
    automatic: true
  });
  return { latestRun, meta, reviewState, target };
}

async function executeAutoReviewContext(orchestrator, options) {
  let result = null;
  try {
    result = await executeTaskReview(orchestrator, {
      taskId: options.taskId,
      meta: options.meta,
      target: options.target,
      runLabel: options.runLabel,
      automatic: true,
      transitionClaim: options.transitionClaim
    });
  } finally {
    await restoreTaskAfterReview(
      orchestrator,
      options.taskId,
      options.reviewState,
      options.transitionClaim
    );
  }
  const review = result?.review || '';
  if (!review.trim()) {
    return { review, resumed: false };
  }
  assertTaskMutationNotStopped(options.transitionClaim);
  const fixPrompt = await buildAutoReviewFixPrompt(review);
  return orchestrator.resumeTask(options.taskId, fixPrompt, {
    transitionClaim: options.releaseTaskRunTransition
  });
}

module.exports = {
  executeAutoReviewContext,
  executeManualReviewContext,
  prepareAutoReviewContext,
  prepareManualReviewContext
};
