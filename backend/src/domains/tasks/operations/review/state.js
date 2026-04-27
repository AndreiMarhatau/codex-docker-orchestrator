const crypto = require('node:crypto');
const { readJson, writeJson } = require('../../../../shared/filesystem/storage');
const { appendRunReviewMessage } = require('./log');
const { reviewTargetLabel } = require('./target');

function appendReviewToRun(run, reviewEntry) {
  return {
    ...run,
    reviews: [...(Array.isArray(run.reviews) ? run.reviews : []), reviewEntry]
  };
}

async function restoreTaskAfterReview(orchestrator, taskId, reviewState, claim) {
  if (!reviewState || claim?.stopRequested) {
    return;
  }
  let meta = await readJson(orchestrator.taskMetaPath(taskId));
  if (meta.status !== 'reviewing') {
    return;
  }
  meta = {
    ...meta,
    status: reviewState.previousStatus || 'completed',
    updatedAt: orchestrator.now()
  };
  await writeJson(orchestrator.taskMetaPath(taskId), meta);
  orchestrator.notifyTasksChanged(taskId);
}

async function beginTaskReview(orchestrator, options) {
  const { taskId, meta, latestRun, target, automatic } = options;
  const reviewState = {
    previousStatus: meta.status || 'completed',
    runId: latestRun.runId
  };
  const startedAt = orchestrator.now();
  await writeJson(orchestrator.taskMetaPath(taskId), {
    ...meta,
    status: 'reviewing',
    updatedAt: startedAt
  });
  try {
    const prefix = automatic ? 'Auto review started' : 'Review started';
    await appendRunReviewMessage(orchestrator, taskId, latestRun.runId, {
      phase: 'started',
      target,
      automatic,
      text: `${prefix}: ${reviewTargetLabel(target)}`
    });
  } catch (error) {
    await restoreTaskAfterReview(orchestrator, taskId, reviewState);
    throw error;
  }
  orchestrator.notifyTasksChanged(taskId);
  return reviewState;
}

async function recordTaskReview(orchestrator, options) {
  const { taskId, runLabel, target, automatic, review } = options;
  const reviewEntry = {
    id: crypto.randomUUID(),
    target,
    automatic,
    createdAt: orchestrator.now(),
    review
  };
  const prefix = automatic ? 'Auto review' : 'Review';
  const text = `${prefix}: ${reviewTargetLabel(target)}\n\n${review || 'No review output.'}`;
  await appendRunReviewMessage(orchestrator, taskId, runLabel, {
    phase: 'completed',
    target,
    automatic,
    text
  });
  const meta = await readJson(orchestrator.taskMetaPath(taskId));
  const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
  if (runIndex !== -1) {
    meta.runs[runIndex] = appendReviewToRun(meta.runs[runIndex], reviewEntry);
    meta.updatedAt = orchestrator.now();
    await writeJson(orchestrator.taskMetaPath(taskId), meta);
  }
  orchestrator.notifyTasksChanged(taskId);
  return { review, target };
}

async function appendReviewFailure(orchestrator, options) {
  const prefix = options.automatic ? 'Auto review failed' : 'Review failed';
  const message = options.error?.message || 'Unknown error';
  await appendRunReviewMessage(orchestrator, options.taskId, options.runLabel, {
    phase: 'failed',
    target: null,
    automatic: options.automatic,
    text: `${prefix}: ${message}`
  });
  orchestrator.notifyTasksChanged(options.taskId);
}

module.exports = {
  appendReviewFailure,
  beginTaskReview,
  recordTaskReview,
  restoreTaskAfterReview
};
