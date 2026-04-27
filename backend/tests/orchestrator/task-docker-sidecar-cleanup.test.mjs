import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('task docker sidecar cleanup', () => {
  it('throws when stopping sidecar fails with non-not-found error', async () => {
    const orchHome = await createTempDir();
    const exec = async (command, args) => {
      if (command === 'docker' && args[0] === 'stop') {
        return { stdout: '', stderr: 'permission denied', code: 1 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });

    await expect(orchestrator.stopTaskDockerSidecar('task-5')).rejects.toThrow(/permission denied/);
  });

  it('uses bounded docker execution for sidecar volume removal', async () => {
    const orchHome = await createTempDir();
    const calls = [];
    const exec = async (command, args, options = {}) => {
      calls.push({ command, args, options });
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });

    await orchestrator.removeTaskDockerSidecar('task-volume');
    const volumeRemoval = calls.find(
      (call) => call.command === 'docker' && call.args[0] === 'volume' && call.args[1] === 'rm'
    );
    expect(volumeRemoval?.options?.signal).toBeTruthy();
  });

  it('keeps the task Docker socket path short enough for unix sockets', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({ orchHome });

    const socketPath = orchestrator.taskDockerSocketPath('85090b0e-22f9-4f21-98a9-79f63d17539f');
    expect(socketPath.length).toBeLessThan(108);
  });
});
