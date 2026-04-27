import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskIdle, waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function extractAppServerDeveloperInstructions(call) {
  return call?.messages?.find((message) =>
    ['thread/start', 'thread/resume'].includes(message.method)
  )?.params?.developerInstructions || null;
}

async function waitForExecCalls(execCalls, predicate, minCount = 1) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const matching = execCalls.filter(predicate);
    if (matching.length >= minCount) {
      return matching;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return execCalls.filter(predicate);
}

describe('Orchestrator task context', () => {
  it('mounts context repos read-only and injects instructions', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const primaryEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main',
      envVars: { API_TOKEN: 'secret', FEATURE_FLAG: '1' }
    });
    const contextEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context.git',
      defaultBranch: 'main'
    });
    await fs.mkdir(path.join(orchHome, 'codex-home'), { recursive: true });
    await fs.writeFile(
      path.join(orchHome, 'codex-home', 'config.toml'),
      'developer_instructions = "Preserve my team rules."\n'
    );

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnv.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall).toBeTruthy();
    const volumeMounts = (runCall.options?.env?.CODEX_VOLUME_MOUNTS || '').split(',');
    expect(volumeMounts.some((entry) => entry.endsWith('=/root/.codex'))).toBe(true);
    expect(volumeMounts.some((entry) => entry.endsWith('=/readonly/context:ro'))).toBe(true);
    expect(runCall.options?.env?.CODEX_PASSTHROUGH_ENV || '').not.toContain('CODEX_HOME');
    expect(runCall.options?.env?.CODEX_AGENTS_APPEND_FILE).toBeUndefined();

    const developerInstructions = extractAppServerDeveloperInstructions(runCall);
    expect(developerInstructions).not.toContain('Preserve my team rules.');
    expect(developerInstructions).not.toContain('task-orchestrator-instructions');
    expect(developerInstructions).toContain('ephemeral Docker container');
    expect(developerInstructions).toContain('Read-only reference repositories');
    expect(developerInstructions).toContain('/readonly/context');
    expect(developerInstructions).toContain('Docker is disabled for this task.');
    expect(developerInstructions).toContain('/root/.artifacts');
    expect(developerInstructions).not.toContain('Environment variables');
    expect(developerInstructions).not.toContain('You are the top-level orchestrator for user requests.');
    expect(developerInstructions).not.toContain('spawn_agent');
    expect(developerInstructions).not.toContain("'reviewer' has to review the changes");
    expect(developerInstructions).not.toContain('You are the developer agent.');
  });

  it('mounts per-task docker sidecar socket when enabled and skips when disabled', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      useHostDockerSocket: true
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    await waitForTaskIdle(orchestrator, task.taskId);

    const createCall = spawn.calls.find((call) => call.command === 'codex-docker');
    const createVolumeMounts = (createCall.options?.env?.CODEX_VOLUME_MOUNTS || '').split(',');
    expect(createVolumeMounts.some((entry) => entry.endsWith('=/var/run/orch-task-docker'))).toBe(true);
    expect(createCall.options?.env?.DOCKER_HOST).toBeUndefined();
    expect(createCall.options?.env?.CODEX_CONTAINER_ENV_DOCKER_HOST).toBe('unix:///var/run/orch-task-docker/docker.sock');
    expect(createCall.options?.env?.CODEX_PASSTHROUGH_ENV || '').not.toContain('CODEX_CONTAINER_ENV_DOCKER_HOST');
    const createDeveloperInstructions = extractAppServerDeveloperInstructions(createCall);
    expect(createDeveloperInstructions).not.toContain('You are the top-level orchestrator for user requests.');
    expect(createDeveloperInstructions).toContain('Docker is enabled for this task via an isolated per-task Docker sidecar daemon.');
    expect(createDeveloperInstructions).toContain('/root/.artifacts');
    expect(createDeveloperInstructions).not.toContain('Environment variables');
    const dockerRunCalls = await waitForExecCalls(
      exec.calls,
      (call) =>
        call.command === 'docker' &&
        call.args[0] === 'run' &&
        call.args.includes(orchestrator.taskDockerSidecarImage)
    );
    expect(dockerRunCalls.length).toBeGreaterThan(0);
    const dockerStopCalls = await waitForExecCalls(
      exec.calls,
      (call) => call.command === 'docker' && call.args[0] === 'stop'
    );
    expect(dockerStopCalls.length).toBeGreaterThan(0);

    await orchestrator.resumeTask(task.taskId, 'Continue', { useHostDockerSocket: false });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const resumeCalls = spawn.calls.filter((call) => call.command === 'codex-docker');
    const resumeCall = resumeCalls[1];
    expect(resumeCall.options?.env?.CODEX_VOLUME_MOUNTS || '').not.toContain('/var/run/orch-task-docker');
    const resumeDeveloperInstructions = extractAppServerDeveloperInstructions(resumeCall);
    expect(resumeDeveloperInstructions).not.toContain('You are the top-level orchestrator for user requests.');
    expect(resumeDeveloperInstructions).toContain('Docker is disabled for this task.');

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.useHostDockerSocket).toBe(false);
  });
});
