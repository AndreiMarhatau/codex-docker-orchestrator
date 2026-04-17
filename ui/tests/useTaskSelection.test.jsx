import { render, screen } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import useTaskSelection from '../src/app/hooks/useTaskSelection.js';

function TaskSelectionProbe() {
  const { handleBackToTasks, selectedTaskId, setSelectedTaskId } = useTaskSelection();

  return (
    <>
      <div data-testid="selected-task">{selectedTaskId}</div>
      <button type="button" onClick={() => setSelectedTaskId('task-2')}>
        Select task-2
      </button>
      <button type="button" onClick={handleBackToTasks}>
        Clear task
      </button>
    </>
  );
}

describe('useTaskSelection', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('reads the initial task id from the query string', () => {
    window.history.pushState({}, '', '/?tab=tasks&taskId=task-1');
    render(<TaskSelectionProbe />);
    expect(screen.getByTestId('selected-task')).toHaveTextContent('task-1');
  });

  it('keeps the taskId query param in sync', async () => {
    window.history.pushState({}, '', '/?tab=tasks');
    const user = userEvent.setup();
    render(<TaskSelectionProbe />);

    await user.click(screen.getByRole('button', { name: 'Select task-2' }));
    expect(window.location.search).toContain('taskId=task-2');

    await user.click(screen.getByRole('button', { name: 'Clear task' }));
    expect(window.location.search).not.toContain('taskId=');
  });
});
