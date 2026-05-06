import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandleResumeTask } from '../src/app/hooks/task-action-builders.js';

const mockApiRequest = vi.fn();

vi.mock('../src/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

function createResumeHandler(overrides = {}) {
  return createHandleResumeTask({
    refreshAll: vi.fn(),
    refreshTaskDetail: vi.fn(),
    resumeAttachmentRemovals: [],
    resumeConfig: {
      customModel: '',
      customReasoningEffort: '',
      modelChoice: '',
      reasoningEffort: ''
    },
    resumeContextRepos: [],
    resumeContextTouched: false,
    resumeFiles: {
      handleClearTaskFiles: vi.fn(),
      setTaskFileUploadProgress: vi.fn(),
      setTaskFileUploading: vi.fn(),
      taskFiles: []
    },
    resumePrompt: 'Continue normally',
    resumeRunAsGoal: false,
    resumeUseHostDockerSocket: false,
    selectedTaskId: 'task-1',
    setError: vi.fn(),
    setLoading: vi.fn(),
    setResumeAttachmentRemovals: vi.fn(),
    setResumeConfig: vi.fn(),
    setResumeContextRepos: vi.fn(),
    setResumeContextTouched: vi.fn(),
    setResumeDockerTouched: vi.fn(),
    setResumePrompt: vi.fn(),
    setResumeRunAsGoal: vi.fn(),
    taskDetail: null,
    ...overrides
  });
}

beforeEach(() => {
  mockApiRequest.mockReset();
  mockApiRequest.mockResolvedValue({});
});

describe('createHandleResumeTask', () => {
  it('clears a saved active goal when resuming without goal mode', async () => {
    const handleResumeTask = createResumeHandler({
      taskDetail: { goal: { objective: 'Old goal', status: 'active' } }
    });

    await handleResumeTask();

    const [, options] = mockApiRequest.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      prompt: 'Continue normally',
      runAsGoal: false,
      clearGoal: true
    });
  });

  it('keeps goal state untouched when resuming in goal mode', async () => {
    const handleResumeTask = createResumeHandler({
      resumeRunAsGoal: true,
      taskDetail: { goal: { objective: 'Old goal', status: 'active' } }
    });

    await handleResumeTask();

    const [, options] = mockApiRequest.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.runAsGoal).toBe(true);
    expect(body.clearGoal).toBeUndefined();
  });
});
