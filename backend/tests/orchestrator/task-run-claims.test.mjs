import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function createOrchestrator() {
  const orchHome = await createTempDir();
  return new Orchestrator({
    orchHome,
    codexHome: path.join(orchHome, 'codex-home'),
    exec: createMockExec({ branches: ['main'] })
  });
}

describe('task run transition claims', () => {
  it('rejects new transition claims while task work is active', async () => {
    const orchestrator = await createOrchestrator();

    const release = orchestrator.claimTaskRunTransition('claimed-task');
    expect(() => orchestrator.claimTaskRunTransition('claimed-task')).toThrow(
      /current run to finish/
    );
    release();

    orchestrator.running.set('running-task', {});
    expect(() => orchestrator.claimTaskRunTransition('running-task')).toThrow(
      /current run to finish/
    );
    orchestrator.running.delete('running-task');

    orchestrator.finalizingTaskRuns = new Map([
      ['finalizing-task', { count: 1, stopRequested: false, afterRelease: [] }]
    ]);
    expect(() => orchestrator.claimTaskRunTransition('finalizing-task')).toThrow(
      /current run to finish/
    );
  });

  it('cancels registered startup work when a transition stop is requested', async () => {
    const orchestrator = await createOrchestrator();
    const release = orchestrator.claimTaskRunTransition('task-1');
    const cancel = vi.fn();

    const unregister = orchestrator.registerTaskRunTransitionCancel('task-1', cancel);
    expect(orchestrator.requestTaskRunTransitionStop('task-1')).toBe(true);
    expect(cancel).toHaveBeenCalledWith('SIGTERM');

    unregister();
    orchestrator.requestTaskRunTransitionStop('task-1');
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
  });

  it('continues startup cancellation when one callback throws', async () => {
    const orchestrator = await createOrchestrator();
    const release = orchestrator.claimTaskRunTransition('task-throwing-cancel');
    const throwingCancel = vi.fn(() => {
      throw new Error('ignored');
    });
    const secondCancel = vi.fn();

    orchestrator.registerTaskRunTransitionCancel('task-throwing-cancel', throwingCancel);
    orchestrator.registerTaskRunTransitionCancel('task-throwing-cancel', secondCancel);

    expect(orchestrator.requestTaskRunTransitionStop('task-throwing-cancel')).toBe(true);
    expect(throwingCancel).toHaveBeenCalledWith('SIGTERM');
    expect(secondCancel).toHaveBeenCalledWith('SIGTERM');
    release();
  });

  it('handles missing claims and already-stopped claims', async () => {
    const orchestrator = await createOrchestrator();
    expect(orchestrator.requestTaskRunTransitionStop('missing')).toBe(false);
    expect(orchestrator.registerTaskRunTransitionCancel('missing', () => {})).toEqual(
      expect.any(Function)
    );
    expect(orchestrator.registerTaskRunTransitionCancel('missing', null)).toEqual(
      expect.any(Function)
    );
    expect(orchestrator.runAfterTaskFinalization('missing', () => {})).toBe(false);
    expect(orchestrator.requestFinalizingTaskStop('missing')).toBe(false);

    const release = orchestrator.claimTaskRunTransition('task-2');
    orchestrator.requestTaskRunTransitionStop('task-2');
    const cancel = vi.fn(() => {
      throw new Error('ignored');
    });
    orchestrator.registerTaskRunTransitionCancel('task-2', cancel);
    expect(cancel).toHaveBeenCalledWith('SIGTERM');
    release();
  });
});
