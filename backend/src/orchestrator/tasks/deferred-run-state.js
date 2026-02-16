function createDeferredRunState() {
  return { child: null, pendingStart: true, stopRequested: false, stopTimeout: null, useProcessGroup: false };
}

function createStoppedDuringStartupError() {
  return Object.assign(new Error('Stopped by user.'), { stopped: true });
}

module.exports = {
  createDeferredRunState,
  createStoppedDuringStartupError
};
