const { STATE_EVENT_TYPES } = require('../app/state-event-types');

function attachStateEventMethods(Orchestrator) {
  Orchestrator.prototype.emitStateEventSafe = function emitStateEventSafe(event, data = {}) {
    if (typeof this.emitStateEvent !== 'function') {
      return;
    }
    try {
      this.emitStateEvent(event, data);
    } catch {
      // Emission failures must never break domain mutations.
    }
  };

  Orchestrator.prototype.notifyTasksChanged = function notifyTasksChanged(taskId = null) {
    this.emitStateEventSafe(STATE_EVENT_TYPES.tasksChanged, taskId ? { taskId } : {});
  };

  Orchestrator.prototype.notifyAccountsChanged = function notifyAccountsChanged(accountId = null) {
    this.emitStateEventSafe(STATE_EVENT_TYPES.accountsChanged, accountId ? { accountId } : {});
  };

  Orchestrator.prototype.notifyEnvsChanged = function notifyEnvsChanged(envId = null) {
    this.emitStateEventSafe(STATE_EVENT_TYPES.envsChanged, envId ? { envId } : {});
  };
}

module.exports = {
  attachStateEventMethods
};
