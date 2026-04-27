const { readJson, writeJson } = require('../../../shared/filesystem/storage');
const { listArtifacts } = require('../../../orchestrator/artifacts');
const { parseThreadId, safeJsonParse, isUsageLimitError } = require('../../../orchestrator/logs');

function createOutputTracker({ logStream, stderrStream }) {
  let stdoutBuffer = '';
  let stdoutFull = '';
  let stderrFull = '';
  let detectedThreadId = null;

  const onStdout = (chunk) => {
    const text = chunk.toString();
    logStream.write(text);
    stdoutFull += text;
    stdoutBuffer += text;
    let index = stdoutBuffer.indexOf('\n');
    while (index !== -1) {
      const line = stdoutBuffer.slice(0, index).trim();
      stdoutBuffer = stdoutBuffer.slice(index + 1);
      if (line) {
        const payload = safeJsonParse(line);
        if (payload?.type === 'thread.started' && payload.thread_id) {
          detectedThreadId = payload.thread_id;
        }
      }
      index = stdoutBuffer.indexOf('\n');
    }
  };

  const onStderr = (chunk) => {
    const text = chunk.toString();
    stderrStream.write(text);
    stderrFull += text;
  };

  const getResult = () => ({
    stdout: stdoutFull,
    stderr: stderrFull,
    threadId: detectedThreadId
  });

  return { onStdout, onStderr, getResult };
}

function resolveRunMetaState({ result, resolvedThreadId, usageLimit, stopped }) {
  const success = !stopped && result.code === 0 && !!resolvedThreadId;
  if (success) {
    return { success, status: 'completed', error: null };
  }
  if (stopped) {
    return { success, status: 'stopped', error: 'Stopped by user.' };
  }
  return {
    success,
    status: 'failed',
    error: usageLimit ? 'Usage limit reached.' : 'Unable to parse thread_id from codex output.'
  };
}

function updateRunEntry({ run, result, artifacts, currentTime, status }) {
  return {
    ...run,
    finishedAt: currentTime,
    status,
    exitCode: result.code,
    gitFingerprintBefore: result.gitFingerprintBefore || run.gitFingerprintBefore || null,
    gitFingerprintAfter: result.gitFingerprintAfter || run.gitFingerprintAfter || null,
    artifacts
  };
}

async function updateRunMeta({
  taskId,
  runLabel,
  result,
  prompt,
  now,
  taskMetaPath,
  runArtifactsDir,
  isStopped
}) {
  const meta = await readJson(taskMetaPath(taskId));
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const threadId = result.threadId || parseThreadId(combinedOutput);
  const resolvedThreadId = threadId || meta.threadId || null;
  const usageLimit = isUsageLimitError(result.stdout);
  const currentTime = now();
  const artifacts = await listArtifacts(runArtifactsDir(taskId, runLabel));
  const stopped = result.stopped === true || isStopped?.() === true;
  if (stopped) {
    result.stopped = true;
  }
  const state = resolveRunMetaState({ result, resolvedThreadId, usageLimit, stopped });

  meta.threadId = resolvedThreadId;
  meta.error = state.error;
  meta.status = state.status;
  meta.updatedAt = currentTime;
  meta.lastPrompt = prompt || meta.lastPrompt || null;

  const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
  if (runIndex !== -1) {
    meta.runs[runIndex] = updateRunEntry({
      run: meta.runs[runIndex],
      result,
      artifacts,
      currentTime,
      status: state.status
    });
  }

  await writeJson(taskMetaPath(taskId), meta);
  return { meta, usageLimit, success: state.success };
}

module.exports = {
  createOutputTracker,
  updateRunMeta
};
