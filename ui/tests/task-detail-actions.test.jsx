import { describe, expect, it, vi } from 'vitest';
import { render, screen } from './test-utils.jsx';
import TaskDetailActions from '../src/app/tabs/tasks/detail/TaskDetailActions.jsx';

vi.mock('../src/app/tabs/tasks/detail/TaskResumeDialog.jsx', () => ({
  __esModule: true,
  default: () => null
}));

function renderActions({ hasTaskDetail = true, isRunning = false, loading = false, showPush = true } = {}) {
  render(
    <TaskDetailActions
      data={{ envs: [], loading }}
      hasTaskDetail={hasTaskDetail}
      isRunning={isRunning}
      showPush={showPush}
      tasksState={{
        actions: { handlePushTask: vi.fn() },
        detail: {},
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

  it('keeps push available for completed tasks with changes', () => {
    renderActions({ isRunning: false, showPush: true });

    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Push' })).toBeEnabled();
  });
});
