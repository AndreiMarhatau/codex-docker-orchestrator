import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function readLatestSkillContent(orchHome, orchestrator, taskId) {
  const metaPath = path.join(orchHome, 'tasks', taskId, 'meta.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const lastRun = meta.runs.at(-1);
  if (!lastRun) {
    throw new Error('No runs found.');
  }
  const skillLogPath = path.join(orchestrator.taskLogsDir(taskId), `${lastRun.runId}.skill.md`);
  return fs.readFile(skillLogPath, 'utf8');
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
      defaultBranch: 'main'
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
    const contextPath = orchestrator.taskContextWorktree(task.taskId, contextEnv.repoUrl, contextEnv.envId);
    expect(mountRo.split(':')).toContain(contextPath);

    const skillContent = await readLatestSkillContent(orchHome, orchestrator, task.taskId);
    expect(skillContent).toContain('Read-only reference repositories');
    expect(skillContent).toContain(contextPath);
  });

  it('mounts docker socket when enabled and skips when disabled', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const codexHome = path.join(orchHome, 'codex-home');
    const socketDir = await createTempDir();
    const socketPath = path.join(socketDir, 'docker.sock');
    await fs.writeFile(socketPath, '');
    const originalDockerSock = process.env.DOCKER_SOCK;
    process.env.DOCKER_SOCK = socketPath;
    try {
      const orchestrator = new Orchestrator({
        orchHome,
        codexHome,
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
      const createMounts = createCall.options?.env?.CODEX_MOUNT_PATHS || '';
      expect(createMounts.split(':')).toContain(socketPath);
      const createSkillContent = await readLatestSkillContent(orchHome, orchestrator, task.taskId);
      expect(createSkillContent).toContain('Host Docker Socket');

      await orchestrator.resumeTask(task.taskId, 'Continue', { useHostDockerSocket: false });
      await waitForTaskStatus(orchestrator, task.taskId, 'completed');

      const resumeCalls = spawn.calls.filter((call) => call.command === 'codex-docker');
      const resumeCall = resumeCalls[1];
      const resumeMounts = resumeCall.options?.env?.CODEX_MOUNT_PATHS || '';
      expect(resumeMounts.split(':')).not.toContain(socketPath);
      const resumeSkillContent = await readLatestSkillContent(orchHome, orchestrator, task.taskId);
      expect(resumeSkillContent).not.toContain('Host Docker Socket');

      const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      expect(meta.useHostDockerSocket).toBe(false);
    } finally {
      if (originalDockerSock === undefined) {
        delete process.env.DOCKER_SOCK;
      } else {
        process.env.DOCKER_SOCK = originalDockerSock;
      }
    }
  });
});
