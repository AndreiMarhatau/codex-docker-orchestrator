const { Orchestrator } = require('./core');
const { attachStateEventMethods } = require('./state-events');
const { attachPathMethods } = require('./paths');
const { attachEnvMethods } = require('./envs');
const { attachTaskMethods } = require('./tasks');
const { attachAccountMethods } = require('./accounts');
const { parseThreadId, isUsageLimitError } = require('./logs');

attachStateEventMethods(Orchestrator);
attachPathMethods(Orchestrator);
attachEnvMethods(Orchestrator);
attachTaskMethods(Orchestrator);
attachAccountMethods(Orchestrator);

module.exports = {
  Orchestrator,
  parseThreadId,
  isUsageLimitError
};
