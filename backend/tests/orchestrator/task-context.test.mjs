import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

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
    const mountRw = runCall.options?.env?.CODEX_MOUNT_PATHS || '';
    const homeDir = orchestrator.taskHomeDir(task.taskId);
    const mountRo = runCall.options?.env?.CODEX_MOUNT_PATHS_RO || '';
    const mountMapsRo = runCall.options?.env?.CODEX_MOUNT_MAPS_RO || '';
    const contextPath = orchestrator.taskContextWorktree(task.taskId, contextEnv.repoUrl, contextEnv.envId);
    expect(mountRw.split(':')).toContain(homeDir);
    expect(mountRo).toBe('');
    expect(mountMapsRo.split(':')).toContain(`${contextPath}=/readonly/context`);

    const agentsFile = runCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
    expect(agentsFile).toBeTruthy();
    const agentsContent = await fs.readFile(agentsFile, 'utf8');
    expect(agentsContent).toContain('Read-only reference repositories');
    expect(agentsContent).toContain('/readonly/context');
    expect(agentsContent).toContain('Environment variables');
    expect(agentsContent).toContain('API_TOKEN');
    expect(agentsContent).toContain('FEATURE_FLAG');
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
    const createAgentsFile = createCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
    expect(createAgentsFile).toBeTruthy();
    const createAgentsContent = await fs.readFile(createAgentsFile, 'utf8');
    expect(createAgentsContent).toContain('Host Docker Socket');
    expect(createAgentsContent).not.toContain('Environment variables');
    const dockerRunCalls = exec.calls.filter(
      (call) =>
        call.command === 'docker' &&
        call.args[0] === 'run' &&
        call.args.includes(orchestrator.taskDockerSidecarImage)
    );
    expect(dockerRunCalls.length).toBeGreaterThan(0);
    const dockerStopCalls = exec.calls.filter(
      (call) => call.command === 'docker' && call.args[0] === 'stop'
    );
    expect(dockerStopCalls.length).toBeGreaterThan(0);

    await orchestrator.resumeTask(task.taskId, 'Continue', { useHostDockerSocket: false });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const resumeCalls = spawn.calls.filter((call) => call.command === 'codex-docker');
    const resumeCall = resumeCalls[1];
    expect(resumeCall.options?.env?.CODEX_MOUNT_MAPS || '').toBe('');
    const resumeAgentsFile = resumeCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
    expect(resumeAgentsFile).toBeTruthy();
    const resumeAgentsContent = await fs.readFile(resumeAgentsFile, 'utf8');
    expect(resumeAgentsContent).not.toContain('Host Docker Socket');

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
