const { readJson, writeJson } = require('../../../shared/filesystem/storage');

function signalRunChild(run, signal) {
  if (!run?.child) {
    return;
  }
  if (
    run.useProcessGroup &&
    Number.isInteger(run.child.pid) &&
    run.child.pid > 0 &&
    process.platform !== 'win32'
  ) {
    try {
      process.kill(-run.child.pid, signal);
      return;
    } catch {
      // Fall back to direct child signal when process-group signaling is unavailable.
    }
  }
  try {
    run.child.kill(signal);
  } catch {
    // Ignore kill errors.
  }
}

async function stopActiveClaimedTask(orchestrator, taskId, meta) {
  if (!orchestrator.isTaskRuntimeActiveStatus(meta.status)) {
    return meta;
  }
  return orchestrator.stopPersistedTaskRun(taskId, meta);
}

function attachTaskStopMethods(Orchestrator) {
  Orchestrator.prototype.stopTask = async function stopTask(taskId) {
    await this.init();
    let meta = await readJson(this.taskMetaPath(taskId));
    meta = await this.reconcileTaskRuntimeState(taskId, meta);
    const run = this.running.get(taskId);
    if (!run) {
      if (meta.status === 'pushing') {
        return meta;
      }
      if (this.requestFinalizingTaskStop(taskId) || this.requestTaskRunTransitionStop(taskId)) {
        return stopActiveClaimedTask(this, taskId, meta);
      }
      if (meta.status === 'stopped') {
        return meta;
      }
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
    if (run.pendingStart && run.startController) {
      run.startController.abort();
      if (this.isTaskRuntimeActiveStatus(meta.status)) {
        return this.stopPersistedTaskRun(taskId, meta);
      }
      return meta;
    }
    signalRunChild(run, 'SIGTERM');
    run.stopTimeout = setTimeout(() => {
      signalRunChild(run, 'SIGKILL');
    }, 5000);

    const updatedAt = this.now();
    meta.status = 'stopping';
    meta.updatedAt = updatedAt;
    if (meta.runs?.length) {
      meta.runs[meta.runs.length - 1] = { ...meta.runs[meta.runs.length - 1], status: 'stopping' };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    this.notifyTasksChanged(taskId);
    return meta;
  };
}

module.exports = {
  attachTaskStopMethods
};
