import { render, screen, waitFor } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits } from './app-fixtures.js';
import mockApi from './helpers/mock-api.js';

it(
  'does not label empty failed runs as pre-spawn failures without an explicit backend marker',
  async () => {
    const failedTask = {
      taskId: 'task-5',
      envId: 'env-1',
      repoUrl: 'https://github.com/openai/codex.git',
      branchName: 'feature/silent-failure',
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
          failedBeforeSpawn: false
        }
      ],
      threadId: null,
      error: 'codex-docker exited early.',
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
            failedBeforeSpawn: false,
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

    await user.click(await screen.findByText('feature/silent-failure'));
    expect(await screen.findByText('Task failed')).toBeInTheDocument();
    expect(screen.getByText('codex-docker exited early.')).toBeInTheDocument();
    expect(screen.getByText('No logs yet.')).toBeInTheDocument();
    expect(
      screen.queryByText('Startup failed before codex-docker spawned')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Run logs are unavailable because startup failed before codex-docker was spawned.'
      )
    ).not.toBeInTheDocument();
  },
  15000
);
