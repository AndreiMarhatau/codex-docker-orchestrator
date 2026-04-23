import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from './test-utils.jsx';
import TaskResumeDialog from '../src/app/tabs/tasks/detail/TaskResumeDialog.jsx';
import TaskForm from '../src/app/tabs/tasks/TaskForm.jsx';

const useMediaQueryMock = vi.fn();

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: (...args) => useMediaQueryMock(...args)
  };
});

vi.mock('../src/app/tabs/tasks/detail/TaskResumeDialogBody.jsx', () => ({
  __esModule: true,
  default: () => <div>resume dialog body</div>
}));

vi.mock('../src/app/tabs/tasks/form/TaskCreateBody.jsx', () => ({
  __esModule: true,
  default: () => <div>task create body</div>
}));

function expectPaperScrollDialog() {
  const dialog = screen.getByRole('dialog');
  const container = dialog.parentElement;

  expect(container).toHaveClass('MuiDialog-scrollPaper');
  expect(container).not.toHaveClass('MuiDialog-scrollBody');
  expect(dialog).toHaveClass('MuiDialog-paperScrollPaper');
  expect(dialog).not.toHaveClass('MuiDialog-paperScrollBody');
}

afterEach(() => {
  useMediaQueryMock.mockReset();
});

describe('task compose dialogs', () => {
  it('keeps the resume dialog in paper-scroll mode on mobile', () => {
    useMediaQueryMock.mockReturnValue(true);

    render(
      <TaskResumeDialog
        actions={{ handleResumeTask: vi.fn() }}
        data={{ loading: false }}
        detail={{
          resumeFiles: {
            taskFileUploading: false,
            taskFileUploadProgress: null
          },
          resumePrompt: 'Continue task',
          taskDetail: { status: 'completed' }
        }}
        envs={[]}
        handleResumeModelChoiceChange={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(screen.getByText('Ask for Changes')).toBeInTheDocument();
    expectPaperScrollDialog();
  });

  it('keeps the create task dialog in paper-scroll mode on mobile', () => {
    useMediaQueryMock.mockReturnValue(true);

    render(
      <TaskForm
        data={{ envs: [], loading: false }}
        tasksState={{
          actions: { handleCreateTask: vi.fn() },
          files: {
            taskFileUploading: false,
            taskFileUploadProgress: null
          },
          formState: {
            setShowTaskForm: vi.fn(),
            showTaskForm: true,
            taskForm: {
              envId: '',
              prompt: 'Create a task'
            }
          }
        }}
      />
    );

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expectPaperScrollDialog();
  });
});
