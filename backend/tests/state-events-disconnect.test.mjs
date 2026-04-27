import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { createResponseRecorder } from './helpers/state-events.mjs';

const require = createRequire(import.meta.url);
const { streamStateEvents } = require('../src/app/routes/events');

describe('state events disconnect handling', () => {
  it('unsubscribes when client disconnects during snapshot build', async () => {
    const bus = new EventEmitter();
    let resolveSnapshot = null;
    const snapshotReady = new Promise((resolve) => {
      resolveSnapshot = resolve;
    });
    let subscribed = 0;
    let unsubscribed = 0;
    const orchestrator = {
      listEnvs: async () => {
        await snapshotReady;
        return [];
      },
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        subscribed += 1;
        bus.on('state', listener);
        return () => {
          unsubscribed += 1;
          bus.off('state', listener);
        };
      }
    };
    const req = new EventEmitter();
    req.off = req.removeListener.bind(req);
    const res = createResponseRecorder();

    const streamPromise = streamStateEvents(orchestrator, req, res);
    req.emit('close');
    resolveSnapshot();
    await streamPromise;

    expect(subscribed).toBe(1);
    expect(unsubscribed).toBe(1);
  });

  it('handles disconnect while flushing pending events after init', async () => {
    const bus = new EventEmitter();
    let resolveSnapshot = null;
    const snapshotReady = new Promise((resolve) => {
      resolveSnapshot = resolve;
    });
    let unsubscribed = 0;
    const orchestrator = {
      listEnvs: async () => {
        await snapshotReady;
        return [];
      },
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => {
          unsubscribed += 1;
          bus.off('state', listener);
        };
      }
    };
    const req = new EventEmitter();
    req.off = req.removeListener.bind(req);
    const res = createResponseRecorder();
    const originalWrite = res.write.bind(res);
    res.write = (chunk) => {
      originalWrite(chunk);
      if (String(chunk).startsWith('data:') && res.chunks.join('').includes('event: init')) {
        req.emit('close');
      }
    };

    const streamPromise = streamStateEvents(orchestrator, req, res);
    bus.emit('state', { event: 'tasks_changed', data: { taskId: 'task-4' } });
    resolveSnapshot();
    await streamPromise;

    expect(unsubscribed).toBe(1);
    const payload = res.chunks.join('');
    expect(payload).toContain('event: init');
  });

  it('cleans up only once on repeated close signals', async () => {
    const bus = new EventEmitter();
    let unsubscribed = 0;
    const orchestrator = {
      listEnvs: async () => [],
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => {
          unsubscribed += 1;
          bus.off('state', listener);
        };
      }
    };
    const req = new EventEmitter();
    req.off = req.removeListener.bind(req);
    const res = createResponseRecorder();

    await streamStateEvents(orchestrator, req, res);
    req.emit('close');
    req.emit('close');
    expect(unsubscribed).toBe(1);
  });
});
