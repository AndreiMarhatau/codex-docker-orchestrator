import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, within } from './test-utils.jsx';
import TaskList from '../src/app/tabs/tasks/TaskList.jsx';
import { DesktopTaskRow } from '../src/app/tabs/tasks/TaskListRow.jsx';

const useMediaQueryMock = vi.fn();

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: (...args) => useMediaQueryMock(...args)
  };
});

function createTask(taskId, overrides = {}) {
  const status = overrides.status || 'completed';
  return {
    taskId,
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: `branch-${taskId}`,
    status,
    runs: status === 'running'
      ? [{ runId: `run-${taskId}`, startedAt: '1970-01-01T00:00:30.000Z' }]
      : [],
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 12, deletions: 4 }
    },
    ...overrides
  };
}

function renderTaskList({ loading = false, selectedTaskId = '', tasks = [] } = {}) {
  const handleDeleteTask = vi.fn();
  const handleStopTask = vi.fn();
  const setSelectedTaskId = vi.fn();

  render(
    <TaskList
      data={{ loading }}
      handleDeleteTask={handleDeleteTask}
      handleStopTask={handleStopTask}
      now={60_000}
      selectedTaskId={selectedTaskId}
      setSelectedTaskId={setSelectedTaskId}
      visibleTasks={tasks}
    />
  );

  return { handleDeleteTask, handleStopTask, setSelectedTaskId };
}

afterEach(() => {
  useMediaQueryMock.mockReset();
});

describe('TaskList', () => {
  it('renders the empty state when there are no visible tasks', () => {
    useMediaQueryMock.mockReturnValue(false);

    renderTaskList();

    expect(screen.getByText('No tasks yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders desktop rows and task actions', async () => {
    useMediaQueryMock.mockReturnValue(false);
    const user = userEvent.setup();
    const runningTask = createTask('task-running', { status: 'running', gitStatus: { hasChanges: true, pushed: false, dirty: true, diffStats: { additions: 20, deletions: 5 } } });
    const stoppedTask = createTask('task-stopped', { status: 'stopped' });
    const { handleDeleteTask, handleStopTask, setSelectedTaskId } = renderTaskList({
      selectedTaskId: 'task-running',
      tasks: [runningTask, stoppedTask]
    });

    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('branch-task-running')).toBeInTheDocument();
    expect(screen.getByText('branch-task-stopped')).toBeInTheDocument();
    expect(screen.getByLabelText('Task duration 0:30')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open task task-running' }).contains(
        screen.getByRole('button', { name: 'Stop' })
      )
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(handleStopTask).toHaveBeenCalledWith('task-running');

    await user.click(screen.getByRole('button', { name: 'Open task task-stopped' }));
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-stopped');

    await user.click(screen.getByLabelText('Remove task task-running'));
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete task?' });
    expect(within(deleteDialog).getByText(/branch-task-running/)).toBeInTheDocument();
    expect(handleDeleteTask).not.toHaveBeenCalled();

    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }));
    expect(handleDeleteTask).toHaveBeenCalledWith('task-running');
  });

  it('keeps delete clicks from bubbling to surrounding task selection handlers', async () => {
    const user = userEvent.setup();
    const task = createTask('task-delete');
    const handleDeleteTask = vi.fn();
    const handleAncestorClick = vi.fn();

    render(
      <div onClick={handleAncestorClick}>
        <DesktopTaskRow
          handleDeleteTask={handleDeleteTask}
          handleStopTask={vi.fn()}
          loading={false}
          now={60_000}
          selectedTaskId=""
          setSelectedTaskId={vi.fn()}
          task={task}
        />
      </div>
    );

    await user.click(screen.getByLabelText('Remove task task-delete'));

    expect(handleDeleteTask).toHaveBeenCalledWith(task);
    expect(handleAncestorClick).not.toHaveBeenCalled();
  });

  it('supports keyboard opening for running tasks without double-activating inline actions', async () => {
    useMediaQueryMock.mockReturnValue(false);
    const user = userEvent.setup();
    const runningTask = createTask('task-running', { status: 'running' });
    const { handleStopTask, setSelectedTaskId } = renderTaskList({ tasks: [runningTask] });

    const summaryButton = screen.getByRole('button', { name: 'Open task task-running' });
    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(summaryButton.contains(stopButton)).toBe(false);

    summaryButton.focus();
    fireEvent.keyDown(summaryButton, { key: 'Enter' });
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-running');

    stopButton.focus();
    await user.keyboard('{Enter}');
    expect(handleStopTask).toHaveBeenCalledWith('task-running');
    expect(setSelectedTaskId).toHaveBeenCalledTimes(1);
  });

  it('renders mobile cards and expands additional tasks', async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    const tasks = [
      createTask('task-1', { status: 'running' }),
      createTask('task-2', { status: 'stopped' }),
      createTask('task-3', { status: 'completed' }),
      createTask('task-4', { status: 'failed' }),
      createTask('task-5', { status: 'stopped' })
    ];
    const { setSelectedTaskId } = renderTaskList({ tasks });

    expect(screen.getByText('branch-task-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Task duration 0:30')).toBeInTheDocument();
    expect(screen.queryByText('branch-task-5')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View more' })).toBeInTheDocument();

    await user.click(screen.getByText('branch-task-1'));
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-1');

    await user.click(screen.getByRole('button', { name: 'View more' }));
    expect(screen.getByText('branch-task-5')).toBeInTheDocument();
  });

  it('supports keyboard opening for running tasks on mobile cards', () => {
    useMediaQueryMock.mockReturnValue(true);
    const runningTask = createTask('task-running', { status: 'running' });
    const { handleStopTask, setSelectedTaskId } = renderTaskList({ tasks: [runningTask] });

    const cardButton = screen.getByRole('button', { name: 'Open task task-running' });
    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(cardButton.contains(stopButton)).toBe(false);

    cardButton.focus();
    fireEvent.keyDown(cardButton, { key: ' ', code: 'Space' });
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-running');

    fireEvent.click(stopButton);
    expect(handleStopTask).toHaveBeenCalledWith('task-running');
    expect(setSelectedTaskId).toHaveBeenCalledTimes(1);
  });

  it('disables task opening while list mutations are loading', async () => {
    useMediaQueryMock.mockReturnValue(false);
    const user = userEvent.setup();
    const task = createTask('task-loading', { status: 'running' });
    const { setSelectedTaskId } = renderTaskList({ loading: true, tasks: [task] });

    const summaryButton = screen.getByRole('button', { name: 'Open task task-loading' });
    expect(summaryButton).toHaveAttribute('aria-disabled', 'true');
    expect(summaryButton).toHaveAttribute('tabindex', '-1');

    await user.click(summaryButton);
    expect(setSelectedTaskId).not.toHaveBeenCalled();
  });

  it('does not render stop for non-stoppable active task states', () => {
    useMediaQueryMock.mockReturnValue(false);
    const task = createTask('task-pushing', { status: 'pushing' });

    renderTaskList({ tasks: [task] });

    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });
});
