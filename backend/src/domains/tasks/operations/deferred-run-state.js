function createDeferredRunState() {
  return {
    child: null,
    pendingStart: true,
    stopRequested: false,
    stopTimeout: null,
    useProcessGroup: false,
    startController: null
  };
}

function createStoppedDuringStartupError() {
  return Object.assign(new Error('Stopped by user.'), { stopped: true });
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

module.exports = {
  createDeferredRunState,
  createStoppedDuringStartupError,
  isAbortError
};
