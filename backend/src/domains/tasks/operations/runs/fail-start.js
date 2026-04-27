const { readJson, writeJson } = require('../../../../shared/filesystem/storage');

function failRunEntry(run, now, stopped) {
  return {
    ...run,
    finishedAt: now,
    status: stopped ? 'stopped' : 'failed',
    exitCode: 1,
    failedBeforeSpawn: stopped ? false : true
  };
}

function attachFailRunStartMethod(Orchestrator) {
  Orchestrator.prototype.failRunStart = async function failRunStart(taskId, runLabel, prompt, error) {
    let meta = null;
    try {
      meta = await readJson(this.taskMetaPath(taskId));
    } catch (readError) {
      return;
    }
    const now = this.now();
    const stopped = error?.stopped === true;
    const message = stopped ? 'Stopped by user.' : error?.message || 'Failed to start Codex run.';
    meta.status = stopped ? 'stopped' : 'failed';
    meta.error = message;
    meta.updatedAt = now;
    meta.lastPrompt = prompt || meta.lastPrompt || null;
    const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
    if (runIndex !== -1) {
      meta.runs[runIndex] = failRunEntry(meta.runs[runIndex], now, stopped);
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    this.notifyTasksChanged(taskId);
  };
}

module.exports = {
  attachFailRunStartMethod
};
