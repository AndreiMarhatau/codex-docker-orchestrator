const { attachDeferredRunStartMethod } = require('./deferred-start');
const { attachFailRunStartMethod } = require('./fail-start');
const { attachFinalizeRunMethod } = require('./finalize');
const { attachStartRunMethod } = require('./start');
const { claimTaskRunTransition, requestClaimStop } = require('./transition');

function attachClaimMethods(Orchestrator) {
  Orchestrator.prototype.claimTaskRunTransition = function claimTaskRunTransitionMethod(taskId) {
    return claimTaskRunTransition(this, taskId);
  };
  Orchestrator.prototype.getTaskRunTransitionClaim = function getTaskRunTransitionClaim(taskId) {
    return this.taskRunClaims?.get(taskId) || null;
  };
  Orchestrator.prototype.requestTaskRunTransitionStop = function requestTaskRunTransitionStop(
    taskId
  ) {
    const claim = this.getTaskRunTransitionClaim(taskId);
    if (!claim) {
      return false;
    }
    requestClaimStop(claim);
    return true;
  };
}

function attachCancelRegistration(Orchestrator) {
  Orchestrator.prototype.registerTaskRunTransitionCancel =
    function registerTaskRunTransitionCancel(taskId, cancel) {
      const claim = this.getTaskRunTransitionClaim(taskId);
      if (!claim || typeof cancel !== 'function') {
        return () => {};
      }
      claim.cancelCallbacks.add(cancel);
      if (claim.stopRequested) {
        try {
          cancel('SIGTERM');
        } catch {
          // Ignore immediate cancellation failures.
        }
      }
      return () => {
        claim.cancelCallbacks.delete(cancel);
      };
    };
}

function attachFinalizationMethods(Orchestrator) {
  Orchestrator.prototype.markTaskRunTransitionRuntimeActive =
    function markTaskRunTransitionRuntimeActive(claim) {
      if (claim) {
        claim.runtimeActive = true;
      }
    };
  Orchestrator.prototype.getFinalizingTaskRun = function getFinalizingTaskRun(taskId) {
    return this.finalizingTaskRuns?.get(taskId) || null;
  };
  Orchestrator.prototype.runAfterTaskFinalization = function runAfterTaskFinalization(
    taskId,
    callback
  ) {
    const state = this.getFinalizingTaskRun(taskId);
    if (!state) {
      return false;
    }
    state.afterRelease.push(callback);
    return true;
  };
  Orchestrator.prototype.requestFinalizingTaskStop = function requestFinalizingTaskStop(taskId) {
    const state = this.getFinalizingTaskRun(taskId);
    if (!state) {
      return false;
    }
    state.stopRequested = true;
    return true;
  };
}

function attachTaskRunMethods(Orchestrator) {
  attachClaimMethods(Orchestrator);
  attachCancelRegistration(Orchestrator);
  attachFinalizationMethods(Orchestrator);
  attachFailRunStartMethod(Orchestrator);
  attachDeferredRunStartMethod(Orchestrator);
  attachFinalizeRunMethod(Orchestrator);
  attachStartRunMethod(Orchestrator);
}

module.exports = {
  attachTaskRunMethods
};
