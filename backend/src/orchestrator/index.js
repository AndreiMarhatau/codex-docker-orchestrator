const { Orchestrator } = require('./core');
const { attachCodexImageMethods } = require('./codex-image');
const { attachStateEventMethods } = require('./state-events');
const { attachPathMethods } = require('./paths');
const { attachEnvMethods } = require('../domains/environments/orchestrator-methods');
const { attachTaskMethods } = require('../domains/tasks/operations');
const { attachAccountMethods } = require('../domains/accounts/orchestrator-methods');
const { attachSetupMethods } = require('../domains/setup/orchestrator-methods');
const { parseThreadId, isUsageLimitError } = require('./logs');

attachStateEventMethods(Orchestrator);
attachCodexImageMethods(Orchestrator);
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
