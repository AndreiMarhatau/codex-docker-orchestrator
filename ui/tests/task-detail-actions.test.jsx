import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from './test-utils.jsx';
import TaskDetailActions from '../src/app/tabs/tasks/detail/TaskDetailActions.jsx';

vi.mock('../src/app/tabs/tasks/detail/TaskResumeDialog.jsx', () => ({
  __esModule: true,
  default: () => null
}));

function renderActions({
  hasTaskDetail = true,
  isRunning = false,
  loading = false,
  onRequestDeleteTask = vi.fn(),
  onRequestStopTask = vi.fn(),
  showCommitPush = true,
  status = 'completed'
} = {}) {
  const handleDeleteTask = vi.fn();
  const handleStopTask = vi.fn();

  render(
    <TaskDetailActions
      data={{ envs: [], loading }}
      hasTaskDetail={hasTaskDetail}
      isRunning={isRunning}
      onRequestDeleteTask={onRequestDeleteTask}
      onRequestStopTask={onRequestStopTask}
      showCommitPush={showCommitPush}
      tasksState={{
        actions: {
          handleCommitPushTask: vi.fn(),
          handleDeleteTask,
          handleReviewTask: vi.fn(),
          handleStopTask
        },
        detail: { taskDetail: { branchName: 'feature/refactor', status, taskId: 'task-1' } },
        handleResumeModelChoiceChange: vi.fn()
      }}
    />
  );

  return { handleDeleteTask, handleStopTask, onRequestDeleteTask, onRequestStopTask };
}

describe('TaskDetailActions', () => {
  it('disables continuation while the task is still active', () => {
    renderActions({ isRunning: true });

    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeDisabled();
  });

  it('keeps commit and push available for completed tasks with changes', () => {
    renderActions({ isRunning: false, showCommitPush: true });

    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Commit & Push' })).toBeEnabled();
  });

  it('shows commit and push as disabled while pushing is in progress', () => {
    renderActions({ status: 'pushing' });

    expect(screen.getByRole('button', { name: 'Pushing' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows stop before delete for stoppable tasks', async () => {
    const user = userEvent.setup();
    const onRequestStopTask = vi.fn();
    renderActions({ onRequestStopTask, status: 'running' });

    const actionButtons = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(actionButtons).toEqual(['Ask for changes', 'Review', 'Commit & Push', 'Stop', 'Delete']);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onRequestStopTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' })
    );
  });

  it('routes delete through the confirmation requester', async () => {
    const user = userEvent.setup();
    const onRequestDeleteTask = vi.fn();
    renderActions({ onRequestDeleteTask });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRequestDeleteTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' })
    );
  });
});
