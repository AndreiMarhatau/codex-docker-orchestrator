const DEFAULT_CHILD_STOP_TIMEOUT_MS = 5000;

function signalChildProcess({ child, useProcessGroup }, signal) {
  if (!child) {
    return;
  }
  if (
    useProcessGroup &&
    Number.isInteger(child.pid) &&
    child.pid > 0 &&
    process.platform !== 'win32'
  ) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to direct child signaling when process-group signaling is unavailable.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Ignore kill errors.
  }
}

function createBoundedChildShutdown({
  child,
  useProcessGroup,
  stopTimeoutMs = DEFAULT_CHILD_STOP_TIMEOUT_MS
}) {
  let closed = false;
  let stopTimeout = null;

  const clearStopTimeout = () => {
    if (stopTimeout) {
      clearTimeout(stopTimeout);
      stopTimeout = null;
    }
  };

  const markClosed = () => {
    closed = true;
    clearStopTimeout();
  };

  child?.once?.('close', markClosed);

  const stop = (signal = 'SIGTERM') => {
    if (closed) {
      return;
    }
    signalChildProcess({ child, useProcessGroup }, signal);
    if (signal !== 'SIGTERM' || stopTimeout || closed) {
      return;
    }
    stopTimeout = setTimeout(() => {
      stopTimeout = null;
      if (!closed) {
        signalChildProcess({ child, useProcessGroup }, 'SIGKILL');
      }
    }, stopTimeoutMs);
    stopTimeout.unref?.();
  };

  return { stop };
}

module.exports = {
  DEFAULT_CHILD_STOP_TIMEOUT_MS,
  createBoundedChildShutdown,
  signalChildProcess
};
