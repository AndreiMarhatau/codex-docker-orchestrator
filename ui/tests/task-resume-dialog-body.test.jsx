import { describe, expect, it, vi } from 'vitest';
import { render, screen } from './test-utils.jsx';
import TaskResumeDialogBody from '../src/app/tabs/tasks/detail/TaskResumeDialogBody.jsx';

function createDetail() {
  return {
    handleAddResumeContextRepo: vi.fn(),
    handleRemoveResumeContextRepo: vi.fn(),
    handleResumeContextRepoChange: vi.fn(),
    resumeAttachmentRemovals: [],
    resumeConfig: {
      customModel: '',
      customReasoningEffort: '',
      modelChoice: '',
      reasoningEffort: ''
    },
    resumeContextRepos: [],
    resumeFiles: {
      handleRemoveTaskFile: vi.fn(),
      handleTaskFilesDropped: vi.fn(),
      handleTaskFilesSelected: vi.fn(),
      taskFileError: '',
      taskFileInputRef: { current: null },
      taskFileUploadProgress: null,
      taskFiles: []
    },
    resumePrompt: 'Investigate the dialog shift',
    resumeUseHostDockerSocket: false,
    resumeUsedContextEnvIds: [],
    setResumeConfig: vi.fn(),
    setResumeDockerTouched: vi.fn(),
    setResumePrompt: vi.fn(),
    setResumeUseHostDockerSocket: vi.fn(),
    taskDetail: {
      attachments: [],
      branchName: 'feature/mobile-dialog',
      status: 'completed'
    },
    toggleResumeAttachmentRemoval: vi.fn()
  };
}

describe('TaskResumeDialogBody', () => {
  it('renders the continuation prompt as a native textarea', () => {
    render(
      <TaskResumeDialogBody
        data={{ loading: false }}
        detail={createDetail()}
        dialogBusy={false}
        envs={[]}
        handleResumeModelChoiceChange={vi.fn()}
      />
    );

    const prompt = screen.getByRole('textbox', { name: 'Continuation prompt' });
    expect(prompt.tagName).toBe('TEXTAREA');
    expect(prompt).toHaveClass('task-compose-textarea');
  });
});
