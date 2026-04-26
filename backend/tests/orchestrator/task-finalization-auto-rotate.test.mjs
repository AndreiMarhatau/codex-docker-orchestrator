import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const { Orchestrator } = require('../../src/orchestrator');

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function waitForValue(readValue) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for value');
}

async function readTaskMeta(orchestrator, taskId) {
  const metaPath = path.join(orchestrator.orchHome, 'tasks', taskId, 'meta.json');
  return JSON.parse(await fsp.readFile(metaPath, 'utf8'));
}

function countRunSpawns(spawnCalls) {
  return spawnCalls.filter((call) => call.command === 'codex-docker' && call.args[0] !== 'app-server')
    .length;
}

describe('Orchestrator finalization auto-rotate cancellation', () => {
  it('does not run queued usage-limit auto-rotate when stopped before finalization release', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fsp.mkdir(codexHome, { recursive: true });
    await fsp.writeFile(
      path.join(codexHome, 'auth.json'),
      JSON.stringify({ token: 'primary' }, null, 2)
    );
    const cleanupStarted = createDeferred();
    const releaseCleanup = createDeferred();
    const spawnCalls = [];
    const spawn = buildSpawnWithUsageLimit({
      spawnCalls,
      rateLimitsByToken: {
        secondary: {
          primary: { usedPercent: 10, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      }
    });
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    orchestrator.stopTaskDockerSidecar = async () => {
      cleanupStarted.resolve();
      await releaseCleanup.promise;
    };
    orchestrator.resumeTask = vi.fn(async () => {
      throw new Error('queued resume should have been cancelled');
    });
    await orchestrator.addAccount({
      label: 'Primary',
      authJson: JSON.stringify({ token: 'primary' })
    });
    await orchestrator.addAccount({
      label: 'Secondary',
      authJson: JSON.stringify({ token: 'secondary' })
    });

    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      useHostDockerSocket: true
    });
    await cleanupStarted.promise;

    await orchestrator.stopTask(task.taskId);
    releaseCleanup.resolve();
    await waitForValue(() => !orchestrator.getFinalizingTaskRun(task.taskId));
    await new Promise((resolve) => setImmediate(resolve));
    const persisted = await readTaskMeta(orchestrator, task.taskId);

    expect(orchestrator.resumeTask).not.toHaveBeenCalled();
    expect(countRunSpawns(spawnCalls)).toBe(1);
    expect(persisted.runs).toHaveLength(1);
    expect(persisted.autoRotateCount || 0).toBe(0);
  });
});
