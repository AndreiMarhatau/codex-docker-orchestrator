import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function readTaskMeta(orchHome, taskId) {
  return JSON.parse(await fs.readFile(path.join(orchHome, 'tasks', taskId, 'meta.json'), 'utf8'));
}

function createOrchestrator(orchHome, options = {}) {
  return new Orchestrator({
    orchHome,
    codexHome: path.join(orchHome, 'codex-home'),
    ...options
  });
}

describe('Orchestrator create cancellation', () => {
  it('cancels structured branch generation when create is stopped', async () => {
    const orchHome = await createTempDir();
    const branchPaused = createDeferred();
    const releaseBranch = createDeferred();
    const spawn = createMockSpawn({
      recordStructuredCodex: true,
      onBeforeTurnComplete: async ({ message, options }) => {
        if (options?.env?.ORCH_STRUCTURED_CODEX === '1' && message.params?.outputSchema) {
          branchPaused.resolve();
          await releaseBranch.promise;
        }
      }
    });
    const exec = createMockExec({ branches: ['main'] });
    const orchestrator = createOrchestrator(orchHome, { exec, spawn });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });

    const createPromise = orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });
    await branchPaused.promise;
    const [taskId] = await fs.readdir(path.join(orchHome, 'tasks'));
    const stopped = await orchestrator.stopTask(taskId);
    const created = await createPromise;

    const branchCall = spawn.calls.find(
      (call) => call.options?.env?.ORCH_STRUCTURED_CODEX === '1'
    );
    expect(branchCall?.child?.killedSignal).toBe('SIGTERM');
    expect(
      exec.calls.some((call) => call.command === 'git' && call.args[2] === 'checkout')
    ).toBe(false);
    expect(stopped.status).toBe('stopped');
    expect(created.status).toBe('stopped');
    expect((await readTaskMeta(orchHome, taskId)).status).toBe('stopped');
  });

  it('escalates stuck structured branch generation and releases the startup claim', async () => {
    const orchHome = await createTempDir();
    const branchPaused = createDeferred();
    const spawn = createMockSpawn({
      recordStructuredCodex: true,
      ignoreSigterm: true,
      onBeforeTurnComplete: async ({ message, options }) => {
        if (options?.env?.ORCH_STRUCTURED_CODEX === '1' && message.params?.outputSchema) {
          branchPaused.resolve();
          await new Promise(() => {});
        }
      }
    });
    const exec = createMockExec({ branches: ['main'] });
    const orchestrator = createOrchestrator(orchHome, { exec, spawn });
    orchestrator.appServerShutdownTimeoutMs = 1;
    await prepareOrchestratorSetup(orchestrator);
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });

    const createPromise = orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });
    await branchPaused.promise;
    const [taskId] = await fs.readdir(path.join(orchHome, 'tasks'));

    await orchestrator.stopTask(taskId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const created = await createPromise;

    const branchCall = spawn.calls.find(
      (call) => call.options?.env?.ORCH_STRUCTURED_CODEX === '1'
    );
    expect(branchCall?.child?.killedSignals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(
      exec.calls.some((call) => call.command === 'git' && call.args[2] === 'checkout')
    ).toBe(false);
    expect(created.status).toBe('stopped');

    await orchestrator.deleteTask(taskId);
    await expect(fs.stat(path.join(orchHome, 'tasks', taskId))).rejects.toThrow();
  });
});
