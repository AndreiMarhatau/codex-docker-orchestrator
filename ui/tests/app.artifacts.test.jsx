import { render, screen, waitFor } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits } from './app-fixtures.js';
import mockApi from './helpers/mock-api.js';

it(
  'shows empty run artifacts and entries',
  async () => {
    const emptyRunTask = {
      taskId: 'task-4',
      envId: 'env-1',
      repoUrl: 'https://github.com/openai/codex.git',
      branchName: 'feature/empty-artifacts',
      ref: 'main',
      model: 'gpt-5.2',
      reasoningEffort: 'low',
      status: 'completed',
      createdAt: '2024-01-03T12:00:00Z',
      runs: [],
      threadId: 'thread-4',
      useHostDockerSocket: false
    };
    mockApi({
      '/api/envs': envs,
      '/api/tasks': [emptyRunTask],
      '/api/accounts': accounts,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${emptyRunTask.taskId}`]: {
        ...emptyRunTask,
        runLogs: [
          {
            runId: 'run-empty',
            model: 'gpt-5.2',
            reasoningEffort: 'low',
            prompt: 'Testing run',
            status: 'completed',
            startedAt: '2024-01-03T12:00:00Z',
            finishedAt: '2024-01-03T12:10:00Z',
            entries: [],
            artifacts: []
          }
        ],
        contextRepos: [],
        gitStatus: { hasChanges: false, dirty: false }
      },
      [`/api/tasks/${emptyRunTask.taskId}/diff`]: {
        available: false,
        reason: 'no base'
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    await user.click(await screen.findByText('feature/empty-artifacts'));
    expect(await screen.findByText('No logs yet.')).toBeInTheDocument();
    expect(screen.getByText('No artifacts for this run.')).toBeInTheDocument();
  },
  15000
);

it(
  'renders artifact grid when only one artifact type exists',
  async () => {
    const singleTypeTask = {
      taskId: 'task-5',
      envId: 'env-1',
      repoUrl: 'https://github.com/openai/codex.git',
      branchName: 'feature/one-type',
      ref: 'main',
      model: 'gpt-5.2',
      reasoningEffort: 'low',
      status: 'completed',
      createdAt: '2024-01-04T12:00:00Z',
      runs: [],
      threadId: 'thread-5',
      useHostDockerSocket: false
    };
    mockApi({
      '/api/envs': envs,
      '/api/tasks': [singleTypeTask],
      '/api/accounts': accounts,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${singleTypeTask.taskId}`]: {
        ...singleTypeTask,
        runLogs: [
          {
            runId: 'run-files',
            model: 'gpt-5.2',
            reasoningEffort: 'low',
            prompt: 'Artifacts only',
            status: 'completed',
            startedAt: '2024-01-04T12:00:00Z',
            finishedAt: '2024-01-04T12:10:00Z',
            entries: [],
            artifacts: [{ path: 'report.txt', size: 512 }]
          }
        ],
        contextRepos: [],
        gitStatus: { hasChanges: false, dirty: false }
      },
      [`/api/tasks/${singleTypeTask.taskId}/diff`]: {
        available: false,
        reason: 'no base'
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    await user.click(await screen.findByText('feature/one-type'));
    expect(await screen.findByText('report.txt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
  },
  15000
);
