import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function extractDeveloperInstructions(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === '-c' || arg === '--config') && typeof args[index + 1] === 'string') {
      const value = args[index + 1];
      if (value.startsWith('developer_instructions=')) {
        return JSON.parse(value.slice('developer_instructions='.length));
      }
    }
    if (typeof arg === 'string' && arg.startsWith('--config=developer_instructions=')) {
      return JSON.parse(arg.slice('--config=developer_instructions='.length));
    }
  }
  return null;
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

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnv.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall).toBeTruthy();
    const mountRo = runCall.options?.env?.CODEX_MOUNT_PATHS_RO || '';
    const mountMapsRo = runCall.options?.env?.CODEX_MOUNT_MAPS_RO || '';
    const contextPath = orchestrator.taskContextWorktree(task.taskId, contextEnv.repoUrl, contextEnv.envId);
    expect(mountRo).toBe('');
    expect(mountMapsRo.split(':')).toContain(`${contextPath}=/readonly/context`);

    expect(runCall.options?.env?.CODEX_AGENTS_APPEND_FILE).toBeUndefined();
    const developerInstructions = extractDeveloperInstructions(runCall.args);
    expect(developerInstructions).toContain('ephemeral Docker container');
    expect(developerInstructions).toContain('Read-only reference repositories');
    expect(developerInstructions).toContain('/readonly/context');
    expect(developerInstructions).toContain('Environment variables');
    expect(developerInstructions).toContain('API_TOKEN');
    expect(developerInstructions).toContain('FEATURE_FLAG');
  });

  it('mounts per-task docker sidecar socket when enabled and skips when disabled', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
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

    const createCall = spawn.calls.find((call) => call.command === 'codex-docker');
    const createMountMaps = createCall.options?.env?.CODEX_MOUNT_MAPS || '';
    const expectedSocketPath = orchestrator.taskDockerSocketPath(task.taskId);
    expect(createMountMaps.split(':')).toContain(`${expectedSocketPath}=/var/run/docker.sock`);
    const createDeveloperInstructions = extractDeveloperInstructions(createCall.args);
    expect(createDeveloperInstructions).toContain('Host Docker Socket');
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
    expect(resumeCall.options?.env?.CODEX_MOUNT_MAPS || '').toBe('');
    const resumeDeveloperInstructions = extractDeveloperInstructions(resumeCall.args);
    expect(resumeDeveloperInstructions).not.toContain('Host Docker Socket');

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.useHostDockerSocket).toBe(false);
  });
});

describe('Orchestrator task context resume', () => {
  it('replaces context repos on resume when provided', async () => {
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
      defaultBranch: 'main'
    });
    const contextEnvA = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context-a.git',
      defaultBranch: 'main'
    });
    const contextEnvB = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context-b.git',
      defaultBranch: 'main'
    });

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnvA.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const contextPathA = orchestrator.taskContextWorktree(
      task.taskId,
      contextEnvA.repoUrl,
      contextEnvA.envId
    );
    const contextPathB = orchestrator.taskContextWorktree(
      task.taskId,
      contextEnvB.repoUrl,
      contextEnvB.envId
    );

    await orchestrator.resumeTask(task.taskId, 'Continue', {
      contextRepos: [{ envId: contextEnvB.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const resumeCall = spawn.calls.filter((call) => call.command === 'codex-docker')[1];
    const mountMapsRo = resumeCall.options?.env?.CODEX_MOUNT_MAPS_RO || '';
    expect(mountMapsRo.split(':')).toContain(`${contextPathB}=/readonly/context-b`);
    expect(mountMapsRo).not.toContain(contextPathA);
    await expect(fs.stat(contextPathA)).rejects.toThrow();

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.contextRepos).toHaveLength(1);
    expect(meta.contextRepos[0].envId).toBe(contextEnvB.envId);
  });
});
