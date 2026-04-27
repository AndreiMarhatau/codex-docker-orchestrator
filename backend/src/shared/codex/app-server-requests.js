function buildThreadParams({ appServerConfig, workspaceDir, developerInstructions, model }) {
  const params = {
    cwd: workspaceDir,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    serviceName: 'codex-docker-orchestrator',
    persistExtendedHistory: true
  };
  if (model) {
    params.model = model;
  }
  if (developerInstructions) {
    params.developerInstructions = developerInstructions;
  }
  if (appServerConfig?.ephemeral === true) {
    params.ephemeral = true;
  }
  return params;
}

function buildTurnParams({ threadId, prompt, workspaceDir, model, reasoningEffort, outputSchema }) {
  const params = {
    threadId,
    input: [{ type: 'text', text: prompt }],
    cwd: workspaceDir,
    approvalPolicy: 'never',
    sandboxPolicy: { type: 'dangerFullAccess' }
  };
  if (model) {
    params.model = model;
  }
  if (reasoningEffort) {
    params.effort = reasoningEffort;
  }
  if (outputSchema) {
    params.outputSchema = outputSchema;
  }
  return params;
}

module.exports = {
  buildThreadParams,
  buildTurnParams
};
