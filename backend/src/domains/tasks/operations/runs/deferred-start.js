const {
  createDeferredRunState,
  createStoppedDuringStartupError,
  isAbortError
} = require('../deferred-run-state');
const { resolveCodexRunImageName } = require('../../../../shared/codex/run-env');
const { beginTaskRunFinalization } = require('./transition');

async function prepareDockerSidecar(orchestrator, taskId, pendingRun, useHostDockerSocket) {
  if (!useHostDockerSocket) {
    return null;
  }
  const hadExistingSidecar = await orchestrator.taskDockerSidecarExists(taskId, {
    signal: pendingRun.startController.signal
  });
  await orchestrator.ensureTaskDockerSidecar(taskId, {
    signal: pendingRun.startController.signal
  });
  return hadExistingSidecar;
}

async function cleanupFailedSidecar(orchestrator, taskId, useHostDockerSocket, hadExistingSidecar) {
  if (!useHostDockerSocket) {
    return;
  }
  try {
    if (hadExistingSidecar !== false) {
      await orchestrator.stopTaskDockerSidecar(taskId);
    } else {
      await orchestrator.removeTaskDockerSidecar(taskId);
    }
  } catch {
    // Best-effort cleanup for sidecar startup failures.
  }
}

async function finalizeDeferredStartFailure(orchestrator, options, pendingRun, error) {
  const releaseFinalizing = beginTaskRunFinalization(orchestrator, options.taskId);
  if (pendingRun.stopTimeout) {
    clearTimeout(pendingRun.stopTimeout);
  }
  try {
    if (orchestrator.running.get(options.taskId) === pendingRun) {
      orchestrator.running.delete(options.taskId);
    }
    await cleanupFailedSidecar(
      orchestrator,
      options.taskId,
      options.useHostDockerSocket,
      options.hadExistingSidecar
    );
    const startupError =
      pendingRun.stopRequested && isAbortError(error) ? createStoppedDuringStartupError() : error;
    try {
      await orchestrator.failRunStart(options.taskId, options.runLabel, options.prompt, startupError);
    } catch {
      // Never surface deferred bookkeeping failures as unhandled rejections.
    }
  } finally {
    releaseFinalizing();
  }
}

function attachDeferredRunStartMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRunDeferred = function startCodexRunDeferred(options) {
    const { taskId, runLabel, prompt, useHostDockerSocket, transitionClaim } = options;
    if (transitionClaim?.stopRequested) {
      void this.failRunStart(taskId, runLabel, prompt, createStoppedDuringStartupError());
      return;
    }
    const pendingRun = createDeferredRunState();
    pendingRun.startController = new AbortController();
    this.running.set(taskId, pendingRun);
    void (async () => {
      let hadExistingSidecar = null;
      try {
        await this.ensureCodexImageReady({
          imageName: resolveCodexRunImageName(this, options.envOverrides),
          signal: pendingRun.startController.signal
        });
        if (pendingRun.stopRequested) {
          throw createStoppedDuringStartupError();
        }
        hadExistingSidecar = await prepareDockerSidecar(this, taskId, pendingRun, useHostDockerSocket);
        if (pendingRun.stopRequested) {
          throw createStoppedDuringStartupError();
        }
        this.startCodexRun(options);
      } catch (error) {
        await finalizeDeferredStartFailure(this, {
          taskId,
          runLabel,
          prompt,
          useHostDockerSocket,
          hadExistingSidecar
        }, pendingRun, error);
      }
    })();
  };
}

module.exports = {
  attachDeferredRunStartMethod
};
