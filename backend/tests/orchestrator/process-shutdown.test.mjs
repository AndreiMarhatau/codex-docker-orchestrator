import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createBoundedChildShutdown,
  signalChildProcess
} = require('../../src/shared/process/shutdown');

function createChild({ pid = null, throwOnKill = false } = {}) {
  const child = new EventEmitter();
  if (Number.isInteger(pid)) {
    child.pid = pid;
  }
  child.signals = [];
  child.kill = (signal) => {
    child.signals.push(signal);
    if (throwOnKill) {
      throw new Error('kill failed');
    }
  };
  return child;
}

describe('process shutdown helpers', () => {
  it('signals process groups when available', () => {
    const child = createChild({ pid: 12345 });
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    try {
      signalChildProcess({ child, useProcessGroup: true }, 'SIGTERM');
      expect(kill).toHaveBeenCalledWith(-12345, 'SIGTERM');
    } finally {
      kill.mockRestore();
    }

    expect(child.signals).toEqual([]);
  });

  it('falls back to direct child signaling and ignores kill errors', () => {
    const child = createChild({ pid: 12345, throwOnKill: true });
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('missing process group');
    });
    try {
      expect(() => signalChildProcess({ child, useProcessGroup: true }, 'SIGTERM'))
        .not.toThrow();
      expect(() => signalChildProcess({ child: null, useProcessGroup: true }, 'SIGTERM'))
        .not.toThrow();
    } finally {
      kill.mockRestore();
    }

    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('escalates bounded shutdown to SIGKILL until the child closes', async () => {
    const child = createChild();
    child.kill = (signal) => {
      child.signals.push(signal);
      if (signal === 'SIGKILL') {
        child.emit('close', 137, signal);
      }
    };
    const shutdown = createBoundedChildShutdown({
      child,
      useProcessGroup: false,
      stopTimeoutMs: 1
    });

    shutdown.stop('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 20));
    shutdown.stop('SIGTERM');

    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('does not signal after the child has already closed', () => {
    const child = createChild();
    const shutdown = createBoundedChildShutdown({
      child,
      useProcessGroup: false,
      stopTimeoutMs: 1
    });
    child.emit('close', 0, null);

    shutdown.stop('SIGTERM');

    expect(child.signals).toEqual([]);
  });
});
