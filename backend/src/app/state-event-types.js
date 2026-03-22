const STATE_EVENT_TYPES = Object.freeze({
  init: 'init',
  tasksChanged: 'tasks_changed',
  envsChanged: 'envs_changed',
  accountsChanged: 'accounts_changed',
  setupChanged: 'setup_changed'
});

module.exports = {
  STATE_EVENT_TYPES
};
