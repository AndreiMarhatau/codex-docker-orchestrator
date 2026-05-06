import { act, render, waitFor } from './test-utils.jsx';
import { beforeEach, expect, it, vi } from 'vitest';

const mockApiRequest = vi.fn();

vi.mock('../src/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

vi.mock('../src/app/hooks/useResumeContextRepos.js', () => ({
  default: vi.fn(() => ({}))
}));

vi.mock('../src/app/hooks/useTaskLogStream.js', () => ({
  default: vi.fn()
}));

import useTaskDetail from '../src/app/hooks/useTaskDetail.js';

let latestDetail = null;

beforeEach(() => {
  latestDetail = null;
  mockApiRequest.mockReset();
});

function TaskDetailProbe({ enabled, selectedTaskId, setError, setSelectedTaskId, tasks = [] }) {
  latestDetail = useTaskDetail({
    enabled,
    envs: [],
    tasks,
    selectedTaskId,
    setError,
    setSelectedTaskId
  });
  return null;
}

it('waits until the app is unlocked before requesting task detail', async () => {
  const setError = vi.fn();
  const setSelectedTaskId = vi.fn();

  const { rerender } = render(
    <TaskDetailProbe
      enabled={false}
      selectedTaskId="task-1"
      setError={setError}
      setSelectedTaskId={setSelectedTaskId}
    />
  );

  expect(mockApiRequest).not.toHaveBeenCalled();

  mockApiRequest
    .mockResolvedValueOnce({
      taskId: 'task-1',
      runLogs: [],
      useHostDockerSocket: false
    })
    .mockResolvedValueOnce({
      available: false,
      reason: 'no diff'
    });

  rerender(
    <TaskDetailProbe
      enabled
      selectedTaskId="task-1"
      setError={setError}
      setSelectedTaskId={setSelectedTaskId}
    />
  );

  await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith('/api/tasks/task-1'));
  await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith('/api/tasks/task-1/diff'));
  expect(setError).not.toHaveBeenCalled();
});

it('resets resume goal mode when switching tasks', async () => {
  const setError = vi.fn();
  const setSelectedTaskId = vi.fn();
  const tasks = [{ taskId: 'task-1', useHostDockerSocket: false }];

  mockApiRequest
    .mockResolvedValueOnce({
      taskId: 'task-1',
      runLogs: [],
      useHostDockerSocket: false
    })
    .mockResolvedValueOnce({ available: false, reason: 'no diff' });

  const { rerender } = render(
    <TaskDetailProbe
      enabled
      selectedTaskId="task-1"
      setError={setError}
      setSelectedTaskId={setSelectedTaskId}
      tasks={tasks}
    />
  );

  await act(async () => {
    latestDetail.setResumeRunAsGoal(true);
  });
  await waitFor(() => expect(latestDetail.resumeRunAsGoal).toBe(true));

  mockApiRequest
    .mockResolvedValueOnce({
      taskId: 'task-2',
      runLogs: [],
      useHostDockerSocket: false
    })
    .mockResolvedValueOnce({ available: false, reason: 'no diff' });

  const nextTasks = [...tasks, { taskId: 'task-2', useHostDockerSocket: false }];
  rerender(
    <TaskDetailProbe
      enabled
      selectedTaskId="task-2"
      setError={setError}
      setSelectedTaskId={setSelectedTaskId}
      tasks={nextTasks}
    />
  );

  await waitFor(() => expect(latestDetail.resumeRunAsGoal).toBe(false));
});
