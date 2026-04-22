import { fireEvent, render, screen, waitFor, within } from './test-utils.jsx';
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

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tasks' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Accounts' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Environments' }));
    await user.click(screen.getByRole('button', { name: 'New source' }));
    const createDialog = await screen.findByRole('dialog', { name: 'Register source' });
    await user.type(
      within(createDialog).getByLabelText('Repository URL'),
      'https://github.com/openai/codex'
    );
    await user.click(within(createDialog).getByRole('button', { name: 'Register source' }));
    expect(await screen.findByText('Failed to create environment.')).toBeInTheDocument();
    expect(
      screen.getByText('No sources yet. Register one to make it available to tasks and runs.')
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Register source' })).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(await screen.findByText('No credits available.')).toBeInTheDocument();
    expect(screen.getAllByText('No data.').length).toBeGreaterThan(0);
    expect(
      screen.getByText('No accounts yet. Add one to enable rotation and usage checks.')
    ).toBeInTheDocument();

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

it(
  'surfaces deferred startup failures in task detail when explicitly marked by the backend',
  async () => {
    const failedTask = {
      taskId: 'task-4',
      envId: 'env-1',
      repoUrl: 'https://github.com/openai/codex.git',
      branchName: 'feature/docker-sidecar',
      ref: 'main',
      model: 'gpt-5.2',
      reasoningEffort: 'high',
      status: 'failed',
      createdAt: '2024-01-02T12:00:00Z',
      runs: [
        {
          runId: 'run-1',
          status: 'failed',
          startedAt: '2024-01-02T12:00:00Z',
          finishedAt: '2024-01-02T12:01:00Z',
          failedBeforeSpawn: true
        }
      ],
      threadId: null,
      error: 'Docker sidecar readiness timed out.',
      useHostDockerSocket: true
    };

    mockApi({
      '/api/envs': envs,
      '/api/tasks': [failedTask],
      '/api/accounts': accounts,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${failedTask.taskId}`]: {
        ...failedTask,
        runLogs: [
          {
            runId: 'run-1',
            status: 'failed',
            startedAt: '2024-01-02T12:00:00Z',
            finishedAt: '2024-01-02T12:01:00Z',
            prompt: 'Use Docker',
            logFile: 'run-1.jsonl',
            failedBeforeSpawn: true,
            artifacts: [],
            entries: []
          }
        ],
        contextRepos: [],
        attachments: [],
        gitStatus: { hasChanges: false, dirty: false }
      },
      [`/api/tasks/${failedTask.taskId}/diff`]: {
        available: false,
        reason: 'no base'
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    await user.click(await screen.findByText('feature/docker-sidecar'));
    expect(
      await screen.findByText('Startup failed before codex-docker spawned')
    ).toBeInTheDocument();
    expect(screen.getByText('Docker sidecar readiness timed out.')).toBeInTheDocument();
    expect(screen.getByText('Use Docker')).toBeInTheDocument();
    expect(screen.queryByText('Raw event log')).not.toBeInTheDocument();
  },
  15000
);
