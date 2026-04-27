const { readJson, writeJson } = require('../../../../shared/filesystem/storage');

const TASK_PUSH_STATUS = 'pushing';

function latestRunLabel(meta) {
  const runs = Array.isArray(meta?.runs) ? meta.runs : [];
  return runs[runs.length - 1]?.runId || null;
}

async function appendPushAgentMessage(orch, taskId, runLabel, text) {
  if (!runLabel || typeof orch.appendRunAgentMessage !== 'function') {
    return;
  }
  try {
    await orch.appendRunAgentMessage(taskId, runLabel, text);
  } catch {
    // Best-effort: push status must not depend on log append success.
  }
}

async function beginTaskPush(orch, taskId, meta, message) {
  const pushState = {
    previousError: meta.error || null,
    previousStatus: meta.status || 'completed',
    runLabel: latestRunLabel(meta)
  };
  await writeJson(orch.taskMetaPath(taskId), {
    ...meta,
    status: TASK_PUSH_STATUS,
    updatedAt: orch.now()
  });
  await appendPushAgentMessage(orch, taskId, pushState.runLabel, message);
  orch.notifyTasksChanged(taskId);
  return pushState;
}

function pushCompleteMessage(result, fallback) {
  const lines = [fallback];
  if (result?.committed && result.commitMessage) {
    lines.push(`Commit: ${result.commitMessage}`);
  }
  if (result?.prCreated && result.prUrl) {
    lines.push(`PR: ${result.prUrl}`);
  }
  return lines.join('\n');
}

async function finishTaskPush(orch, options) {
  let meta = null;
  try {
    meta = await readJson(orch.taskMetaPath(options.taskId));
  } catch {
    return;
  }
  if (options.transitionClaim?.stopRequested || meta.status !== TASK_PUSH_STATUS) {
    return;
  }
  const updatedMeta = options.error
    ? {
        ...meta,
        status: 'failed',
        error: `${options.failureMessage}: ${options.error?.message || 'Unknown error'}`,
        updatedAt: orch.now()
      }
    : {
        ...meta,
        status: options.pushState.previousStatus || 'completed',
        error: options.pushState.previousError,
        updatedAt: orch.now()
      };
  await writeJson(orch.taskMetaPath(options.taskId), updatedMeta);
  const message = options.error
    ? `${options.failureMessage}: ${options.error?.message || 'Unknown error'}`
    : pushCompleteMessage(options.result, options.successMessage);
  await appendPushAgentMessage(orch, options.taskId, options.pushState.runLabel, message);
  orch.notifyTasksChanged(options.taskId);
}

module.exports = {
  beginTaskPush,
  finishTaskPush
};
