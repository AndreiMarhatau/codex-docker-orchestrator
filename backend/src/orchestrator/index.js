const { Orchestrator } = require('./core');
const { attachPathMethods } = require('./paths');
const { attachEnvMethods } = require('./envs');
const { attachImageMethods } = require('./images');
const { attachTaskMethods } = require('./tasks');
const { attachAccountMethods } = require('./accounts');
const { parseThreadId, isUsageLimitError } = require('./logs');

attachPathMethods(Orchestrator);
attachEnvMethods(Orchestrator);
attachImageMethods(Orchestrator);
attachTaskMethods(Orchestrator);
attachAccountMethods(Orchestrator);

module.exports = {
  Orchestrator,
  parseThreadId,
  isUsageLimitError
};
