/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { streamStateEvents } = require('../src/app/routes/events');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(chunk);
    }
  };
}

describe('state events stream', () => {
  it('sends init snapshot and streamed invalidation events', async () => {
    const bus = new EventEmitter();
    const orchestrator = {
      listEnvs: async () => [{ envId: 'env-1' }],
      listTasks: async () => [{ taskId: 'task-1' }],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => bus.off('state', listener);
      }
    };
    const req = new EventEmitter();
    const res = createResponseRecorder();

    await streamStateEvents(orchestrator, req, res);
    bus.emit('state', { event: 'tasks_changed', data: { taskId: 'task-1' } });
    req.emit('close');

    const payload = res.chunks.join('');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(payload).toContain('event: init');
    expect(payload).toContain('"envId":"env-1"');
    expect(payload).toContain('event: tasks_changed');
    expect(payload).toContain('"taskId":"task-1"');
  });

  it('stops emitting after connection closes', async () => {
    const bus = new EventEmitter();
    const orchestrator = {
      listEnvs: async () => [],
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => bus.off('state', listener);
      }
    };
    const req = new EventEmitter();
    const res = createResponseRecorder();

    await streamStateEvents(orchestrator, req, res);
    req.emit('close');
    const before = res.chunks.length;
    bus.emit('state', { event: 'tasks_changed', data: { taskId: 'task-1' } });
    expect(res.chunks.length).toBe(before);
  });

  it('buffers events raised during initial snapshot build', async () => {
    const bus = new EventEmitter();
    let resolveSnapshot = null;
    const snapshotReady = new Promise((resolve) => {
      resolveSnapshot = resolve;
    });
    const orchestrator = {
      listEnvs: async () => {
        await snapshotReady;
        return [];
      },
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => bus.off('state', listener);
      }
    };
    const req = new EventEmitter();
    const res = createResponseRecorder();

    const streamPromise = streamStateEvents(orchestrator, req, res);
    bus.emit('state', { event: 'tasks_changed', data: { taskId: 'task-2' } });
    resolveSnapshot();
    await streamPromise;

    const payload = res.chunks.join('');
    expect(payload.indexOf('event: init')).toBeGreaterThanOrEqual(0);
    expect(payload.indexOf('event: tasks_changed')).toBeGreaterThan(payload.indexOf('event: init'));
    expect(payload).toContain('"taskId":"task-2"');
  });

  it('ignores invalid event payloads', async () => {
    const bus = new EventEmitter();
    const orchestrator = {
      listEnvs: async () => [],
      listTasks: async () => [],
      listAccounts: async () => ({ accounts: [], activeAccountId: null }),
      subscribeStateEvents(listener) {
        bus.on('state', listener);
        return () => bus.off('state', listener);
      }
    };
    const req = new EventEmitter();
    const res = createResponseRecorder();

    await streamStateEvents(orchestrator, req, res);
    const before = res.chunks.length;
    bus.emit('state', { data: { taskId: 'task-3' } });
    bus.emit('state', null);
    expect(res.chunks.length).toBe(before);
  });

  it('unsubscribes when snapshot build fails', async () => {
    const bus = new EventEmitter();
    let subscribed = 0;
    let unsubscribed = 0;
    const orchestrator = {
      listEnvs: async () => {
        throw new Error('snapshot failed');
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
    const res = createResponseRecorder();

    await expect(streamStateEvents(orchestrator, req, res)).rejects.toThrow('snapshot failed');
    expect(subscribed).toBe(1);
    expect(unsubscribed).toBe(1);
  });

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
