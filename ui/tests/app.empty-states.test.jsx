import { render, screen, waitFor } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits } from './app-fixtures.js';
import mockApi from './helpers/mock-api.js';

it(
  'surfaces empty states and errors',
  async () => {
    mockApi({
      '/api/envs': [],
      '/api/tasks': [],
      '/api/accounts': { accounts: [], activeAccountId: null },
      'POST /api/envs': { ok: false, text: 'Failed to create environment.' },
      'POST /api/accounts': { ok: false, text: 'Failed to create account.' },
      '/api/accounts/rate-limits': {
        rateLimits: {
          credits: { hasCredits: false },
          primary: null,
          secondary: null
        },
        fetchedAt: ''
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    expect(await screen.findByText('No tasks yet. Create one to get started.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Environments' }));
    await user.type(screen.getByLabelText('Repository URL'), 'https://github.com/openai/codex');
    await user.click(screen.getByRole('button', { name: 'Create environment' }));
    expect(await screen.findByText('Failed to create environment.')).toBeInTheDocument();
    expect(screen.getByText('No environments yet. Create one to get started.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(await screen.findByText('No credits available.')).toBeInTheDocument();
    expect(screen.getAllByText('No data.').length).toBeGreaterThan(0);
    expect(screen.getByText('No accounts yet. Add one to enable rotation.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
  },
  15000
);

it(
  'shows empty run logs in task detail',
  async () => {
    const emptyTask = {
      taskId: 'task-3',
      envId: 'env-1',
      repoUrl: 'https://github.com/openai/codex.git',
      branchName: 'feature/empty',
      ref: 'main',
      model: 'gpt-5.2',
      reasoningEffort: 'high',
      status: 'completed',
      createdAt: '2024-01-02T12:00:00Z',
      runs: [],
      threadId: 'thread-3',
      useHostDockerSocket: false
    };
    mockApi({
      '/api/envs': envs,
      '/api/tasks': [emptyTask],
      '/api/accounts': accounts,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${emptyTask.taskId}`]: {
        ...emptyTask,
        runLogs: [],
        contextRepos: [],
        gitStatus: { hasChanges: false, dirty: false }
      },
      [`/api/tasks/${emptyTask.taskId}/diff`]: {
        available: false,
        reason: 'no base'
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    await user.click(await screen.findByText('feature/empty'));
    expect(await screen.findByText('No logs yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Diff' }));
    expect(screen.getByText('Diff unavailable: no base')).toBeInTheDocument();
  },
  15000
);
