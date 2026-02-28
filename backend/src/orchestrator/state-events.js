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
    this.emitStateEventSafe('tasks_changed', taskId ? { taskId } : {});
  };

  Orchestrator.prototype.notifyAccountsChanged = function notifyAccountsChanged(accountId = null) {
    this.emitStateEventSafe('accounts_changed', accountId ? { accountId } : {});
  };

  Orchestrator.prototype.notifyEnvsChanged = function notifyEnvsChanged(envId = null) {
    this.emitStateEventSafe('envs_changed', envId ? { envId } : {});
  };
}

module.exports = {
  attachStateEventMethods
};
