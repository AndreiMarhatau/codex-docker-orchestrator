import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from './test-utils.jsx';
import TaskDetailHeader from '../src/app/tabs/tasks/detail/TaskDetailHeader.jsx';

function createTaskDetail(overrides = {}) {
  const status = overrides.status || 'completed';
  return {
    taskId: 'task-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/ui-refresh',
    status,
    ref: 'main',
    createdAt: '2024-05-12T22:42:00Z',
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 12, deletions: 4 }
    },
    runLogs: status === 'running'
      ? [{ runId: 'run-1', status: 'running', startedAt: '1970-01-01T00:00:30.000Z' }]
      : [],
    ...overrides
  };
}

function renderHeader(
  taskDetail = createTaskDetail(),
  { loading = false, now = 60_000, onRequestDeleteTask, onRequestStopTask } = {}
) {
  const handleBackToTasks = vi.fn();
  const handleDeleteTask = vi.fn();
  const handleStopTask = vi.fn();

  render(
    <TaskDetailHeader
      loading={loading}
      now={now}
      onRequestDeleteTask={onRequestDeleteTask}
      onRequestStopTask={onRequestStopTask}
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
    const onRequestStopTask = vi.fn();
    const { handleBackToTasks, handleDeleteTask, handleStopTask } = renderHeader(
      createTaskDetail({ status: 'running' }),
      { onRequestStopTask }
    );

    expect(screen.getAllByText('codex/ui-refresh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('openai/codex').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Task duration 0:30')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Back to tasks'));
    expect(handleBackToTasks).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onRequestStopTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' })
    );
    expect(handleStopTask).not.toHaveBeenCalled();

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

  it('routes header delete through the confirmation requester when provided', async () => {
    const user = userEvent.setup();
    const onRequestDeleteTask = vi.fn();
    const { handleDeleteTask } = renderHeader(createTaskDetail(), { onRequestDeleteTask });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRequestDeleteTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' })
    );
    expect(handleDeleteTask).not.toHaveBeenCalled();
  });

  it('falls back to direct stop when no confirmation requester is provided', async () => {
    const user = userEvent.setup();
    const { handleStopTask } = renderHeader(createTaskDetail({ status: 'running' }));

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(handleStopTask).toHaveBeenCalledWith('task-1');
  });

  it('does not render stop for stopping tasks', () => {
    renderHeader(
      createTaskDetail({
        status: 'stopping',
        runLogs: [{ runId: 'run-1', status: 'stopping', startedAt: '1970-01-01T00:00:30.000Z' }]
      })
    );

    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Task duration 0:30')).toBeInTheDocument();
  });

  it('does not render stop for push operations', () => {
    renderHeader(createTaskDetail({ status: 'pushing' }));

    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });
});
