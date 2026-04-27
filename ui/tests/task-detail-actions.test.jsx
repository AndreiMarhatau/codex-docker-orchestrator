import { describe, expect, it, vi } from 'vitest';
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
  showCommitPush = true,
  status = 'completed'
} = {}) {
  render(
    <TaskDetailActions
      data={{ envs: [], loading }}
      hasTaskDetail={hasTaskDetail}
      isRunning={isRunning}
      showCommitPush={showCommitPush}
      tasksState={{
        actions: { handleCommitPushTask: vi.fn(), handleReviewTask: vi.fn() },
        detail: { taskDetail: { status } },
        handleResumeModelChoiceChange: vi.fn()
      }}
    />
  );
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
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
