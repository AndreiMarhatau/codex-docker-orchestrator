import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { setupDockerResumeTask } from './task-resume-sidecar-helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator resume sidecar startup stop handling', () => {
  it('allows stopping while sidecar startup is pending', async () => {
    const orchHome = await createTempDir();
    const codexHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
    await setupDockerResumeTask(orchestrator, orchHome);

    orchestrator.ensureTaskDockerSidecar = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return orchestrator.taskDockerSocketPath('task-1');
    };

    await orchestrator.resumeTask('task-1', 'Continue');
    await expect(orchestrator.stopTask('task-1')).resolves.toBeTruthy();
    const stopped = await waitForTaskStatus(orchestrator, 'task-1', 'stopped');
    expect(stopped.error).toBe('Stopped by user.');
  });

  it('cancels blocked sidecar startup when stop is requested', async () => {
    const orchHome = await createTempDir();
    const codexHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
    await setupDockerResumeTask(orchestrator, orchHome);

    orchestrator.ensureTaskDockerSidecar = async (_taskId, options = {}) =>
      new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });

    await orchestrator.resumeTask('task-1', 'Continue');
    await expect(orchestrator.stopTask('task-1')).resolves.toBeTruthy();
    const stopped = await waitForTaskStatus(orchestrator, 'task-1', 'stopped');
    expect(stopped.error).toBe('Stopped by user.');
    expect(stopped.runs[1].status).toBe('stopped');
  });

  it('uses non-destructive cleanup when stop interrupts sidecar inspect', async () => {
    const orchHome = await createTempDir();
    const codexHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
    await setupDockerResumeTask(orchestrator, orchHome);

    const calls = [];
    orchestrator.taskDockerSidecarExists = async (_taskId, options = {}) =>
      new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    orchestrator.stopTaskDockerSidecar = async () => {
      calls.push('stop');
    };
    orchestrator.removeTaskDockerSidecar = async () => {
      calls.push('remove');
    };

    await orchestrator.resumeTask('task-1', 'Continue');
    await orchestrator.stopTask('task-1');
    await waitForTaskStatus(orchestrator, 'task-1', 'stopped');
    expect(calls).toContain('stop');
    expect(calls).not.toContain('remove');
  });
});
