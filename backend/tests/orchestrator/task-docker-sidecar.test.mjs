import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createDockerExec({
  inspectCode = 1,
  inspectStdout = '',
  inspectStderr = 'No such container',
  infoCode = 0
} = {}) {
  const calls = [];
  const exec = async (command, args) => {
    calls.push({ command, args });
    if (command !== 'docker') {
      return { stdout: '', stderr: '', code: 0 };
    }
    if (args[0] === 'volume' && args[1] === 'create') {
      return { stdout: `${args[2] || 'volume'}\n`, stderr: '', code: 0 };
    }
    if (args[0] === 'volume' && args[1] === 'rm') {
      return { stdout: '', stderr: '', code: 0 };
    }
    if (args[0] === 'container' && args[1] === 'inspect') {
      return { stdout: inspectStdout, stderr: inspectStderr, code: inspectCode };
    }
    if (args[0] === '--host' && args[2] === 'info') {
      return { stdout: infoCode === 0 ? 'ok' : '', stderr: infoCode === 0 ? '' : 'not ready', code: infoCode };
    }
    if (args[0] === 'run' || args[0] === 'start' || args[0] === 'stop' || args[0] === 'rm') {
      return { stdout: '', stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
  exec.calls = calls;
  return exec;
}

describe('task docker sidecar', () => {
  it('creates sidecar when container does not exist', async () => {
    const orchHome = await createTempDir();
    const exec = createDockerExec({ inspectCode: 1, inspectStderr: 'No such container' });
    const orchestrator = new Orchestrator({ orchHome, exec });

    const socketPath = await orchestrator.ensureTaskDockerSidecar('task-1');
    expect(socketPath).toBe(path.join(orchHome, 'tasks', 'task-1', 'docker', 'sock', 'docker.sock'));
    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'run')
    ).toBe(true);
  });

  it('starts existing stopped sidecar', async () => {
    const orchHome = await createTempDir();
    const exec = createDockerExec({ inspectCode: 0, inspectStdout: 'false\n' });
    const orchestrator = new Orchestrator({ orchHome, exec });

    await orchestrator.ensureTaskDockerSidecar('task-2');
    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'start')
    ).toBe(true);
  });

  it('skips start when existing sidecar is already running and ignores missing sidecar on stop', async () => {
    const orchHome = await createTempDir();
    const calls = [];
    const exec = async (command, args) => {
      calls.push({ command, args });
      if (command !== 'docker') {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === 'volume' && args[1] === 'create') {
        return { stdout: 'vol\n', stderr: '', code: 0 };
      }
      if (args[0] === 'container' && args[1] === 'inspect') {
        return { stdout: 'true\n', stderr: '', code: 0 };
      }
      if (args[0] === '--host' && args[2] === 'info') {
        return { stdout: 'ok', stderr: '', code: 0 };
      }
      if (args[0] === 'stop') {
        return { stdout: '', stderr: 'No such container', code: 1 };
      }
      if (args[0] === 'rm') {
        return { stdout: '', stderr: 'No such container', code: 1 };
      }
      if (args[0] === 'volume' && args[1] === 'rm') {
        return { stdout: '', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });

    await orchestrator.ensureTaskDockerSidecar('task-3');
    await orchestrator.stopTaskDockerSidecar('task-3');
    await orchestrator.removeTaskDockerSidecar('task-3');
    expect(
      calls.some((call) => call.command === 'docker' && call.args[0] === 'start')
    ).toBe(false);
  });

  it('fails when sidecar does not become ready before timeout', async () => {
    const orchHome = await createTempDir();
    const exec = createDockerExec({
      inspectCode: 1,
      inspectStderr: 'No such container',
      infoCode: 1
    });
    const orchestrator = new Orchestrator({
      orchHome,
      exec,
      taskDockerReadyTimeoutMs: 10,
      taskDockerReadyIntervalMs: 5
    });

    await expect(orchestrator.ensureTaskDockerSidecar('task-4')).rejects.toThrow(
      /did not become ready/
    );
  });

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
});
