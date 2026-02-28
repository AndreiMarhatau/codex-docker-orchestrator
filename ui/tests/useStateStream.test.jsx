import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from './test-utils.jsx';
import useStateStream from '../src/app/hooks/useStateStream.js';

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.listeners = new Map();
    MockEventSource.instances.push(this);
  }

  addEventListener(event, listener) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  removeEventListener(event, listener) {
    const listeners = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      listeners.filter((entry) => entry !== listener)
    );
  }

  close() {
    this.closed = true;
  }

  emit(event, data) {
    const listeners = this.listeners.get(event) || [];
    for (const listener of listeners) {
      listener({ data });
    }
  }
}

MockEventSource.instances = [];

function StreamHarness(props) {
  useStateStream(props);
  return null;
}

describe('useStateStream', () => {
  it('applies init snapshot and refreshes selected task detail', async () => {
    MockEventSource.instances = [];
    global.EventSource = MockEventSource;

    const setEnvs = vi.fn();
    const setTasks = vi.fn();
    const setAccountState = vi.fn();
    const setError = vi.fn();
    const refreshAll = vi.fn(async () => {});
    const refreshTaskDetail = vi.fn(async () => {});

    render(
      <StreamHarness
        enabled
        refreshAll={refreshAll}
        refreshTaskDetail={refreshTaskDetail}
        selectedTaskId="task-1"
        setAccountState={setAccountState}
        setEnvs={setEnvs}
        setError={setError}
        setTasks={setTasks}
      />
    );

    const stream = MockEventSource.instances[0];
    stream.emit(
      'init',
      JSON.stringify({
        envs: [{ envId: 'env-1' }],
        tasks: [{ taskId: 'task-1' }],
        accounts: { accounts: [], activeAccountId: null }
      })
    );

    await waitFor(() => {
      expect(setEnvs).toHaveBeenCalledWith([{ envId: 'env-1' }]);
      expect(setTasks).toHaveBeenCalledWith([{ taskId: 'task-1' }]);
      expect(setAccountState).toHaveBeenCalledWith({ accounts: [], activeAccountId: null });
      expect(refreshTaskDetail).toHaveBeenCalledWith('task-1');
      expect(setError).not.toHaveBeenCalled();
    });
  });

  it('refreshes data on invalidation events and closes stream on cleanup', async () => {
    MockEventSource.instances = [];
    global.EventSource = MockEventSource;

    const refreshAll = vi.fn(async () => {});
    const refreshTaskDetail = vi.fn(async () => {});
    const { unmount } = render(
      <StreamHarness
        enabled
        refreshAll={refreshAll}
        refreshTaskDetail={refreshTaskDetail}
        selectedTaskId="task-2"
        setAccountState={vi.fn()}
        setEnvs={vi.fn()}
        setError={vi.fn()}
        setTasks={vi.fn()}
      />
    );

    const stream = MockEventSource.instances[0];
    stream.emit('tasks_changed', JSON.stringify({ taskId: 'task-2' }));

    await waitFor(() => {
      expect(refreshAll).toHaveBeenCalledTimes(1);
      expect(refreshTaskDetail).toHaveBeenCalledWith('task-2');
    });

    unmount();
    expect(stream.closed).toBe(true);
  });
});
