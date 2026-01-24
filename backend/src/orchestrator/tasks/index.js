const { attachTaskCleanupMethods } = require('./cleanup');
const { attachTaskContextMethods } = require('./context');
const { attachTaskCreateMethods } = require('./create');
const { attachTaskExposedMethods } = require('./exposed');
const { attachTaskLogMethods } = require('./logs');
const { attachTaskMetaMethods } = require('./meta');
const { attachTaskRotationMethods } = require('./rotation');
const { attachTaskResumeMethods } = require('./resume');
const { attachTaskRunMethods } = require('./runs');

function attachTaskMethods(Orchestrator) {
  attachTaskAttachmentMethods(Orchestrator);
  attachTaskMetaMethods(Orchestrator);
  attachTaskLogMethods(Orchestrator);
  attachTaskContextMethods(Orchestrator);
  attachTaskExposedMethods(Orchestrator);
  attachTaskRunMethods(Orchestrator);
  attachTaskRotationMethods(Orchestrator);
  attachTaskCreateMethods(Orchestrator);
  attachTaskResumeMethods(Orchestrator);
  attachTaskCleanupMethods(Orchestrator);
}

module.exports = {
  attachTaskMethods
};
const { attachTaskAttachmentMethods } = require('./attachments');
