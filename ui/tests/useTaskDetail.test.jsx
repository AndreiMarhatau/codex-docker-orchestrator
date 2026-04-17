import { render, waitFor } from './test-utils.jsx';
import { vi } from 'vitest';

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

function TaskDetailProbe({ enabled, selectedTaskId, setError, setSelectedTaskId }) {
  useTaskDetail({
    enabled,
    envs: [],
    tasks: [],
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
