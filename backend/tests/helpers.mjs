export { createMockExec } from './helpers/exec.mjs';
export { createMockSpawn } from './helpers/spawn.mjs';
export {
  countAppServerTaskRuns,
  createManualAppServerSpawn
} from './helpers/app-server-spawn.mjs';
export { createTempDir } from './helpers/temp.mjs';

export async function prepareOrchestratorSetup(orchestrator, options = {}) {
  const token = options.token || 'test-github-token';
  const authJson = options.authJson || '{}';
  await orchestrator.setGitToken(token);
  return orchestrator.addAccount({
    label: options.label || 'Primary',
    authJson
  });
}
