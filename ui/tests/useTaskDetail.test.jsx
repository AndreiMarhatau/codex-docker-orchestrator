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

it('clears untouched resume goal defaults when the task goal completes', async () => {
  const setError = vi.fn();
  const setSelectedTaskId = vi.fn();
  const tasks = [{ taskId: 'task-1', useHostDockerSocket: false }];

  mockApiRequest
    .mockResolvedValueOnce({
      taskId: 'task-1',
      goal: { objective: 'Finish everything', status: 'active' },
      runLogs: [],
      useHostDockerSocket: false
    })
    .mockResolvedValueOnce({ available: false, reason: 'no diff' });

  render(
    <TaskDetailProbe
      enabled
      selectedTaskId="task-1"
      setError={setError}
      setSelectedTaskId={setSelectedTaskId}
      tasks={tasks}
    />
  );

  await waitFor(() => expect(latestDetail.resumeGoalObjective).toBe('Finish everything'));

  mockApiRequest
    .mockResolvedValueOnce({
      taskId: 'task-1',
      goal: { objective: 'Finish everything', status: 'complete' },
      runLogs: [],
      useHostDockerSocket: false
    })
    .mockResolvedValueOnce({ available: false, reason: 'no diff' });

  await act(async () => {
    await latestDetail.refreshTaskDetail('task-1');
  });

  await waitFor(() => expect(latestDetail.resumeGoalObjective).toBe(''));
  expect(latestDetail.initialResumeGoalObjective).toBe('');
});
