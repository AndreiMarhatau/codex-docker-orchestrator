import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator stopTask', () => {
  it('signals the spawned process group when available', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const childrenByPid = new Map();
    const spawn = (command, args) => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = vi.fn(() => {});

      if (command === 'codex-docker' && args[0] !== 'app-server') {
        child.pid = 43210;
        childrenByPid.set(child.pid, child);
      } else {
        setImmediate(() => {
          child.stdout.end();
          child.emit('close', 0, null);
        });
      }

      return child;
    };

    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid < 0) {
        const child = childrenByPid.get(Math.abs(pid));
        if (child) {
          setImmediate(() => {
            child.emit('close', 143, signal);
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

      await orchestrator.stopTask(task.taskId);
      await waitForTaskStatus(orchestrator, task.taskId, 'stopped');

      expect(killSpy).toHaveBeenCalledWith(-43210, 'SIGTERM');
      const run = orchestrator.running.get(task.taskId);
      expect(run).toBeUndefined();
    } finally {
      killSpy.mockRestore();
    }
  });
});
