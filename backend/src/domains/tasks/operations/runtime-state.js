const { listDirs, pathExists, readJson, writeJson } = require('../../../shared/filesystem/storage');

const ACTIVE_TASK_STATUSES = new Set(['running', 'reviewing', 'pushing', 'stopping']);
const LOST_RUNNER_ERROR = 'Task interrupted because the runner process is no longer active.';
const USER_STOPPED_ERROR = 'Stopped by user.';

function isActiveTaskStatus(status) {
  return ACTIVE_TASK_STATUSES.has(status);
}

function hasActiveRunHandle(orchestrator, taskId) {
  const transitionClaim = orchestrator.taskRunClaims?.get(taskId);
  return (
    orchestrator.running.has(taskId) ||
    transitionClaim?.runtimeActive === true ||
    orchestrator.finalizingTaskRuns?.has(taskId)
  );
}

function staleTaskRuntimeCleanups(orchestrator) {
  if (!orchestrator.staleTaskRuntimeCleanups) {
    orchestrator.staleTaskRuntimeCleanups = new Map();
  }
  return orchestrator.staleTaskRuntimeCleanups;
}

function scheduleTaskSidecarStopIfNeeded(orchestrator, taskId, meta) {
  if (!meta?.useHostDockerSocket) {
    return null;
  }
  const cleanups = staleTaskRuntimeCleanups(orchestrator);
  const existingCleanup = cleanups.get(taskId);
  if (existingCleanup) {
    return existingCleanup;
  }
  const cleanup = Promise.resolve()
    .then(() => orchestrator.stopTaskDockerSidecar(taskId))
    .catch(() => {
      // Reconciliation must not make task listing or startup fail because cleanup failed.
    })
    .finally(() => {
      if (cleanups.get(taskId) === cleanup) {
        cleanups.delete(taskId);
      }
    });
  cleanups.set(taskId, cleanup);
  return cleanup;
}

function markLatestRunStopped(meta, stoppedAt) {
  const runs = Array.isArray(meta.runs) ? meta.runs : [];
  if (runs.length === 0) {
    return runs;
  }
  const updatedRuns = [...runs];
  const latestIndex = updatedRuns.length - 1;
  const latestRun = updatedRuns[latestIndex] || {};
  if (isActiveTaskStatus(latestRun.status) || !latestRun.finishedAt) {
    updatedRuns[latestIndex] = {
      ...latestRun,
      status: 'stopped',
      finishedAt: latestRun.finishedAt || stoppedAt,
      exitCode: latestRun.exitCode ?? null
    };
  }
  return updatedRuns;
}

function attachTaskRuntimeStateMethods(Orchestrator) {
  Orchestrator.prototype.isTaskRuntimeActiveStatus = function isTaskRuntimeActiveStatus(status) {
    return isActiveTaskStatus(status);
  };

  Orchestrator.prototype.stopPersistedTaskRun = async function stopPersistedTaskRun(
    taskId,
    meta,
    errorMessage = USER_STOPPED_ERROR
  ) {
    const stoppedAt = this.now();
    const updatedMeta = {
      ...meta,
      status: 'stopped',
      error: errorMessage,
      updatedAt: stoppedAt,
      runs: markLatestRunStopped(meta, stoppedAt)
    };
    await writeJson(this.taskMetaPath(taskId), updatedMeta);
    this.notifyTasksChanged(taskId);
    return updatedMeta;
  };

  Orchestrator.prototype.reconcileTaskRuntimeState = async function reconcileTaskRuntimeState(
    taskId,
    meta
  ) {
    if (!isActiveTaskStatus(meta?.status) || hasActiveRunHandle(this, taskId)) {
      return meta;
    }

    const updatedMeta = await this.stopPersistedTaskRun(taskId, meta, LOST_RUNNER_ERROR);
    scheduleTaskSidecarStopIfNeeded(this, taskId, updatedMeta);
    return updatedMeta;
  };

  Orchestrator.prototype.awaitStaleTaskRuntimeCleanup =
    async function awaitStaleTaskRuntimeCleanup(taskId) {
      const cleanup = this.staleTaskRuntimeCleanups?.get(taskId);
      if (cleanup) {
        await cleanup;
      }
    };

  Orchestrator.prototype.reconcilePersistedTaskStates = async function reconcilePersistedTaskStates() {
    await this.init();
    const taskIds = await listDirs(this.tasksDir());
    const reconciled = [];
    for (const taskId of taskIds) {
      const metaPath = this.taskMetaPath(taskId);
      if (!(await pathExists(metaPath))) {
        continue;
      }
      const meta = await readJson(metaPath);
      const updatedMeta = await this.reconcileTaskRuntimeState(taskId, meta);
      if (updatedMeta !== meta) {
        reconciled.push(updatedMeta);
      }
    }
    return reconciled;
  };
}

module.exports = {
  LOST_RUNNER_ERROR,
  USER_STOPPED_ERROR,
  attachTaskRuntimeStateMethods
};
