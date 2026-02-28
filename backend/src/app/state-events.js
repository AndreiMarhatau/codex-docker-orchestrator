function createStateEventBus() {
  const listeners = new Set();

  function emit(event, data = {}) {
    const message = { event, data };
    for (const listener of listeners) {
      try {
        listener(message);
      } catch {
        // Never let one subscriber failure affect others.
      }
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    emit,
    subscribe
  };
}

module.exports = {
  createStateEventBus
};
