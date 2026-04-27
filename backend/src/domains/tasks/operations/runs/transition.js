function createTaskBusyError() {
  const error = new Error('Wait for the current run to finish before continuing this task.');
  error.code = 'TASK_BUSY';
  return error;
}

function beginTaskRunFinalization(orchestrator, taskId) {
  const finalizingTaskRuns = orchestrator.finalizingTaskRuns || new Map();
  orchestrator.finalizingTaskRuns = finalizingTaskRuns;
  const state = finalizingTaskRuns.get(taskId) || {
    count: 0,
    stopRequested: false,
    afterRelease: []
  };
  state.count += 1;
  finalizingTaskRuns.set(taskId, state);
  return () => {
    const activeState = finalizingTaskRuns.get(taskId);
    if (!activeState) {
      return;
    }
    activeState.count -= 1;
    if (activeState.count > 0) {
      return;
    }
    const callbacks = activeState.stopRequested ? [] : activeState.afterRelease || [];
    finalizingTaskRuns.delete(taskId);
    for (const callback of callbacks) {
      void Promise.resolve().then(callback).catch(() => {});
    }
  };
}

function claimTaskRunTransition(orchestrator, taskId) {
  const taskRunClaims = orchestrator.taskRunClaims || new Map();
  orchestrator.taskRunClaims = taskRunClaims;
  if (
    taskRunClaims.has(taskId) ||
    orchestrator.running.has(taskId) ||
    orchestrator.finalizingTaskRuns?.has(taskId)
  ) {
    throw createTaskBusyError();
  }
  const claim = {
    token: Symbol(taskId),
    stopRequested: false,
    runtimeActive: false,
    cancelCallbacks: new Set()
  };
  taskRunClaims.set(taskId, claim);
  const release = () => {
    if (taskRunClaims.get(taskId) === claim) {
      taskRunClaims.delete(taskId);
    }
  };
  release.claim = claim;
  return release;
}

function requestClaimStop(claim) {
  claim.stopRequested = true;
  for (const cancel of claim.cancelCallbacks || []) {
    try {
      cancel('SIGTERM');
    } catch {
      // Cancellation callbacks are best-effort; stop still updates task state.
    }
  }
}

module.exports = {
  beginTaskRunFinalization,
  claimTaskRunTransition,
  requestClaimStop
};
