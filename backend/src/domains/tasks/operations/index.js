const { attachTaskCleanupMethods } = require('./cleanup');
const { attachTaskContextMethods } = require('./context');
const { attachTaskCreateMethods } = require('./create');
const { attachTaskDockerSidecarMethods } = require('./docker-sidecar');
const { attachTaskExposedMethods } = require('./exposed');
const { attachTaskLogMethods } = require('./logs');
const { attachTaskMetaMethods } = require('./meta');
const { attachTaskRotationMethods } = require('./rotation');
const { attachTaskResumeMethods } = require('./resume');
const { attachTaskRunMethods } = require('./runs');
const { attachTaskRuntimeStateMethods } = require('./runtime-state');
const { attachTaskStopMethods } = require('./stop');
const { attachTaskAttachmentMethods } = require('./attachments');
const { attachBranchNameMethods } = require('./branch-name');
const { attachTaskReviewMethods } = require('./review');

function attachTaskMethods(Orchestrator) {
  attachTaskAttachmentMethods(Orchestrator);
  attachBranchNameMethods(Orchestrator);
  attachTaskRuntimeStateMethods(Orchestrator);
  attachTaskMetaMethods(Orchestrator);
  attachTaskLogMethods(Orchestrator);
  attachTaskContextMethods(Orchestrator);
  attachTaskExposedMethods(Orchestrator);
  attachTaskDockerSidecarMethods(Orchestrator);
  attachTaskRunMethods(Orchestrator);
  attachTaskRotationMethods(Orchestrator);
  attachTaskCreateMethods(Orchestrator);
  attachTaskResumeMethods(Orchestrator);
  attachTaskStopMethods(Orchestrator);
  attachTaskReviewMethods(Orchestrator);
  attachTaskCleanupMethods(Orchestrator);
}

module.exports = {
  attachTaskMethods
};
