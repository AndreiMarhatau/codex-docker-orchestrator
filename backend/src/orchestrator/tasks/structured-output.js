const { buildRunEnv } = require('./run-helpers');
const { runAppServerTurn } = require('./app-server-runner');
const { createBoundedChildShutdown } = require('./process-shutdown');

function createMemoryTracker() {
  let stdout = '';
  let stderr = '';
  return {
    onStdout(chunk) {
      stdout += chunk.toString();
    },
    onStderr(chunk) {
      stderr += chunk.toString();
    },
    getResult() {
      return { stdout, stderr };
    }
  };
}

function parseJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function runStructuredCodex({
  orchestrator,
  taskId,
  cwd,
  workspaceDir,
  volumeMounts = [],
  envOverrides,
  artifactsDir,
  prompt,
  model,
  reasoningEffort,
  developerInstructions,
  outputSchema
}) {
  const env = buildRunEnv({
    orchestrator,
    workspaceDir,
    artifactsDir,
    volumeMounts,
    envOverrides
  });
  env.ORCH_STRUCTURED_CODEX = '1';
  const useProcessGroup = process.platform !== 'win32';
  const child = orchestrator.spawn('codex-docker', ['app-server'], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: useProcessGroup
  });
  const shutdown = createBoundedChildShutdown({
    child,
    useProcessGroup,
    stopTimeoutMs: orchestrator.appServerShutdownTimeoutMs
  });
  const unregisterCancel = taskId
    ? orchestrator.registerTaskRunTransitionCancel?.(taskId, shutdown.stop) || (() => {})
    : () => {};
  const tracker = createMemoryTracker();
  try {
    const result = await runAppServerTurn({
      child,
      tracker,
      prompt,
      workspaceDir,
      appServerConfig: {
        ephemeral: true,
        model,
        reasoningEffort,
        developerInstructions,
        outputSchema
      }
    });
    if (result.code !== 0) {
      throw new Error(tracker.getResult().stderr || 'Codex structured output run failed.');
    }
    const message = result.agentMessages[result.agentMessages.length - 1] || '';
    const parsed = parseJsonObject(message);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Codex returned invalid structured output.');
    }
    return parsed;
  } finally {
    unregisterCancel();
    shutdown.stop('SIGTERM');
  }
}

module.exports = {
  parseJsonObject,
  runStructuredCodex
};
