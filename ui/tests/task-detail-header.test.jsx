import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from './test-utils.jsx';
import TaskDetailHeader from '../src/app/tabs/tasks/detail/TaskDetailHeader.jsx';

function createTaskDetail(overrides = {}) {
  return {
    taskId: 'task-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/ui-refresh',
    status: 'completed',
    ref: 'main',
    createdAt: '2024-05-12T22:42:00Z',
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 12, deletions: 4 }
    },
    runLogs: [],
    ...overrides
  };
}

function renderHeader(taskDetail = createTaskDetail(), { loading = false } = {}) {
  const handleBackToTasks = vi.fn();
  const handleDeleteTask = vi.fn();
  const handleStopTask = vi.fn();

  render(
    <TaskDetailHeader
      loading={loading}
      tasksState={{
        actions: { handleDeleteTask, handleStopTask },
        detail: { taskDetail },
        selection: { handleBackToTasks }
      }}
    />
  );

  return { handleBackToTasks, handleDeleteTask, handleStopTask };
}

describe('TaskDetailHeader', () => {
  it('renders running tasks with header actions', async () => {
    const user = userEvent.setup();
    const { handleBackToTasks, handleDeleteTask, handleStopTask } = renderHeader(
      createTaskDetail({ status: 'running' })
    );

    expect(screen.getAllByText('codex/ui-refresh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('openai/codex').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Back to tasks'));
    expect(handleBackToTasks).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(handleStopTask).toHaveBeenCalledWith('task-1');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleDeleteTask).toHaveBeenCalledWith('task-1');
  });

  it('shows the pre-spawn failure alert for failed runs', () => {
    renderHeader(
      createTaskDetail({
        status: 'failed',
        error: 'Task failed before codex-docker spawned.',
        runLogs: [{ runId: 'run-1', failedBeforeSpawn: true }]
      })
    );

    expect(screen.getByText('Startup failed before codex-docker spawned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });

  it('shows the stopped-task alert variant', () => {
    renderHeader(
      createTaskDetail({
        status: 'stopped',
        error: 'Stopped by user.'
      })
    );

    expect(screen.getByText('Task stopped')).toBeInTheDocument();
    expect(screen.getByText('Stopped by user.')).toBeInTheDocument();
  });

  it('disables stop and delete while a task action is loading', () => {
    renderHeader(createTaskDetail({ status: 'running' }), { loading: true });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
