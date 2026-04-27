import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

export const NOW = '2026-01-02T03:04:05.000Z';

export function buildStaleRunningMeta(taskId, overrides = {}) {
  return {
    taskId,
    envId: 'env-1',
    repoUrl: 'git@example.com:repo.git',
    branchName: `codex/${taskId}`,
    worktreePath: null,
    status: 'running',
    error: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    useHostDockerSocket: false,
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
    ],
    ...overrides
  };
}

export async function writeTaskMeta(orchHome, meta) {
  const taskDir = path.join(orchHome, 'tasks', meta.taskId);
  await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
  await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

export async function readTaskMeta(orchHome, taskId) {
  return JSON.parse(await fs.readFile(path.join(orchHome, 'tasks', taskId, 'meta.json'), 'utf8'));
}

export function createOrchestrator(orchHome, options = {}) {
  return new Orchestrator({
    orchHome,
    codexHome: path.join(orchHome, 'codex-home'),
    now: () => NOW,
    ...options
  });
}

export function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

export async function withTimeout(promise, timeoutMs = 100) {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out waiting for operation')), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
