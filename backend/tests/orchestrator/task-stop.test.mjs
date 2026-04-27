import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createManualAppServerSpawn, createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');
const { LOST_RUNNER_ERROR, USER_STOPPED_ERROR } = require('../../src/domains/tasks/operations/runtime-state');

const NOW = '2026-01-02T03:04:05.000Z';

async function writeTaskMeta(orchHome, taskId, meta) {
  const taskDir = path.join(orchHome, 'tasks', taskId);
  await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
  await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

async function readTaskMeta(orchHome, taskId) {
  return JSON.parse(await fs.readFile(path.join(orchHome, 'tasks', taskId, 'meta.json'), 'utf8'));
}

function createManualRunSpawn() {
  return createManualAppServerSpawn();
}

async function waitForRunServer(spawn) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const server = spawn.latestServer();
    if (server) {
      await server.waitForTurnStart();
      return server;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for app-server run');
}

describe('Orchestrator stopTask', () => {
  it('signals the spawned process group when available', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createManualAppServerSpawn({ pid: 43210 });

    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid < 0) {
        const server = spawn.latestServer();
        if (server) {
          setImmediate(() => {
            server.close(143, signal);
          });
        }
      }
      return true;
    });

    try {
      const orchestrator = new Orchestrator({
        orchHome,
        codexHome: path.join(orchHome, 'codex-home'),
        exec,
        spawn
      });

      const env = await orchestrator.createEnv({
        repoUrl: 'git@example.com:repo.git',
        defaultBranch: 'main'
      });
      const task = await orchestrator.createTask({
        envId: env.envId,
        ref: 'main',
        prompt: 'Do work'
      });
      await waitForRunServer(spawn);

      await orchestrator.stopTask(task.taskId);
      await waitForTaskStatus(orchestrator, task.taskId, 'stopped');

      expect(killSpy).toHaveBeenCalledWith(-43210, 'SIGTERM');
      const run = orchestrator.running.get(task.taskId);
      expect(run).toBeUndefined();
    } finally {
      killSpy.mockRestore();
    }
  });

  it('treats missing in-memory run state as an already interrupted stop', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      now: () => NOW
    });
    await writeTaskMeta(orchHome, 'task-lost', {
      taskId: 'task-lost',
      envId: 'env-1',
      repoUrl: 'git@example.com:repo.git',
      branchName: 'codex/task-lost',
      worktreePath: null,
      status: 'running',
      error: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      runs: [
        {
          runId: 'run-001',
          prompt: 'Do work',
          logFile: 'run-001.jsonl',
          startedAt: '2026-01-01T00:00:00.000Z',
          finishedAt: null,
          status: 'running',
          exitCode: null
        }
      ]
    });

    const stopped = await orchestrator.stopTask('task-lost');
    const stoppedAgain = await orchestrator.stopTask('task-lost');
    const persisted = await readTaskMeta(orchHome, 'task-lost');

    expect(stopped.status).toBe('stopped');
    expect(stopped.error).toBe(LOST_RUNNER_ERROR);
    expect(stoppedAgain.status).toBe('stopped');
    expect(persisted.runs[0].status).toBe('stopped');
    expect(persisted.runs[0].finishedAt).toBe(NOW);
  });
});

describe('Orchestrator stopTask during finalization', () => {
  it('returns stopped state instead of throwing while run finalization is in progress', async () => {
    const orchHome = await createTempDir();
    const spawn = createManualRunSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn,
      now: () => NOW
    });
    const originalFinalizeRun = orchestrator.finalizeRun.bind(orchestrator);
    let releaseFinalize = null;
    let finalizeStartedResolve = null;
    let finalizeFinishedResolve = null;
    const finalizeStarted = new Promise((resolve) => { finalizeStartedResolve = resolve; });
    const finalizeFinished = new Promise((resolve) => { finalizeFinishedResolve = resolve; });
    const finalizeBlocked = new Promise((resolve) => { releaseFinalize = resolve; });
    orchestrator.finalizeRun = async (...args) => {
      finalizeStartedResolve();
      await finalizeBlocked;
      try {
        return await originalFinalizeRun(...args);
      } finally {
        finalizeFinishedResolve();
      }
    };

    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const server = await waitForRunServer(spawn);
    server.completeTurn();
    await finalizeStarted;
    expect(orchestrator.running.get(task.taskId)).toBeUndefined();

    const stopped = await orchestrator.stopTask(task.taskId);
    releaseFinalize();
    await finalizeFinished;
    const persisted = await readTaskMeta(orchHome, task.taskId);

    expect(stopped.status).toBe('stopped');
    expect(stopped.error).toBe(USER_STOPPED_ERROR);
    expect(persisted.status).toBe('stopped');
    expect(persisted.error).toBe(USER_STOPPED_ERROR);
  });
});
