const { attachTaskCleanupMethods } = require('./cleanup');
const { attachTaskContextMethods } = require('./context');
const { attachTaskCreateMethods } = require('./create');
const { attachTaskLogMethods } = require('./logs');
const { attachTaskMetaMethods } = require('./meta');
const { attachTaskRotationMethods } = require('./rotation');
const { attachTaskResumeMethods } = require('./resume');
const { attachTaskRunMethods } = require('./runs');

function attachTaskMethods(Orchestrator) {
  attachTaskMetaMethods(Orchestrator);
  attachTaskLogMethods(Orchestrator);
  attachTaskContextMethods(Orchestrator);
  attachTaskRunMethods(Orchestrator);
  attachTaskRotationMethods(Orchestrator);
  attachTaskCreateMethods(Orchestrator);
  attachTaskResumeMethods(Orchestrator);
  attachTaskCleanupMethods(Orchestrator);
}

module.exports = {
  attachTaskMethods
};
