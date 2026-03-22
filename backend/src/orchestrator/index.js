const { Orchestrator } = require('./core');
const { attachStateEventMethods } = require('./state-events');
const { attachPathMethods } = require('./paths');
const { attachEnvMethods } = require('./envs');
const { attachTaskMethods } = require('./tasks');
const { attachAccountMethods } = require('./accounts');
const { attachSetupMethods } = require('./setup');
const { parseThreadId, isUsageLimitError } = require('./logs');

attachStateEventMethods(Orchestrator);
attachPathMethods(Orchestrator);
attachEnvMethods(Orchestrator);
attachTaskMethods(Orchestrator);
attachAccountMethods(Orchestrator);
attachSetupMethods(Orchestrator);

module.exports = {
  Orchestrator,
  parseThreadId,
  isUsageLimitError
};
