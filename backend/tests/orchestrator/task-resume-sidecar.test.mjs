import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator resume sidecar cleanup', () => {
  it('does not create or clean sidecar when resume fails before deferred startup', async () => {
    const orchHome = await createTempDir();
    const calls = [];
    const exec = async (command, args) => {
      calls.push({ command, args });
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });
    const envDir = path.join(orchHome, 'envs', 'env-1');
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
    await fs.writeFile(path.join(envDir, 'default_branch'), 'main');
    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId: 'task-1',
        envId: 'env-1',
        threadId: 'thread-1',
        worktreePath: path.join(taskDir, 'worktree'),
        branchName: 'codex/task-1',
        useHostDockerSocket: false,
        runs: [{ runId: 'run-001', prompt: 'start', logFile: 'run-001.jsonl', startedAt: 'now', status: 'completed' }]
      })
    );

    orchestrator.readEnv = async () => {
      throw new Error('env failed');
    };

    await expect(
      orchestrator.resumeTask('task-1', 'Continue', { useHostDockerSocket: true })
    ).rejects.toThrow(/env failed/);
    expect(calls.some((call) => call.command === 'docker')).toBe(false);
  });

  it('cleans up sidecar asynchronously when deferred run startup fails', async () => {
    const orchHome = await createTempDir();
    const calls = [];
    const exec = async (command, args) => {
      calls.push({ command, args });
      if (command === 'docker') {
        if (args[0] === 'container' && args[1] === 'inspect') {
          return { stdout: 'false\n', stderr: '', code: 0 };
        }
        if (args[0] === 'volume' && args[1] === 'create') {
          return { stdout: 'vol\n', stderr: '', code: 0 };
        }
        if (args[0] === 'start' || args[0] === 'stop' || args[0] === 'run') {
          return { stdout: '', stderr: '', code: 0 };
        }
        if (args[0] === '--host' && args[2] === 'info') {
          return { stdout: 'ok', stderr: '', code: 0 };
        }
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });
    const envDir = path.join(orchHome, 'envs', 'env-1');
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
    await fs.writeFile(path.join(envDir, 'default_branch'), 'main');
    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId: 'task-1',
        envId: 'env-1',
        threadId: 'thread-1',
        worktreePath: path.join(taskDir, 'worktree'),
        branchName: 'codex/task-1',
        useHostDockerSocket: true,
        runs: [{ runId: 'run-001', prompt: 'start', logFile: 'run-001.jsonl', startedAt: 'now', status: 'completed' }]
      })
    );

    orchestrator.startCodexRun = () => {
      throw new Error('run failed');
    };

    await orchestrator.resumeTask('task-1', 'Continue');
    await waitForTaskStatus(orchestrator, 'task-1', 'failed');
    expect(calls.some((call) => call.command === 'docker' && call.args[0] === 'start')).toBe(true);
    expect(calls.some((call) => call.command === 'docker' && call.args[0] === 'stop')).toBe(true);
  });
});

describe('orchestrator resume sidecar startup stop handling', () => {
  async function setupDockerResumeTask(orchestrator, orchHome) {
    const envDir = path.join(orchHome, 'envs', 'env-1');
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
    await fs.writeFile(path.join(envDir, 'default_branch'), 'main');
    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId: 'task-1',
        envId: 'env-1',
        threadId: 'thread-1',
        worktreePath: path.join(taskDir, 'worktree'),
        branchName: 'codex/task-1',
        useHostDockerSocket: true,
        runs: [{ runId: 'run-001', prompt: 'start', logFile: 'run-001.jsonl', startedAt: 'now', status: 'completed' }]
      })
    );
  }

  it('allows stopping while sidecar startup is pending', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
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
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
    await setupDockerResumeTask(orchestrator, orchHome);

    orchestrator.ensureTaskDockerSidecar = async (_taskId, options = {}) =>
      new Promise((_, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });

    await orchestrator.resumeTask('task-1', 'Continue');
    await expect(orchestrator.stopTask('task-1')).resolves.toBeTruthy();
    const stopped = await waitForTaskStatus(orchestrator, 'task-1', 'stopped');
    expect(stopped.error).toBe('Stopped by user.');
    expect(stopped.runs[1].status).toBe('stopped');
  });

  it('uses non-destructive cleanup when stop interrupts sidecar inspect', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
    await setupDockerResumeTask(orchestrator, orchHome);

    const calls = [];
    orchestrator.taskDockerSidecarExists = async (_taskId, options = {}) =>
      new Promise((_, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
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
