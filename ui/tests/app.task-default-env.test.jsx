import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import mockApi from './helpers/mock-api.js';

it(
  'defaults new task environment to the latest task environment',
  async () => {
    const envs = [
      {
        envId: 'env-1',
        repoUrl: 'https://github.com/openai/codex.git',
        defaultBranch: 'main'
      },
      {
        envId: 'env-2',
        repoUrl: 'https://github.com/openai/agents.git',
        defaultBranch: 'main'
      }
    ];
    const tasks = [
      {
        taskId: 'task-1',
        envId: 'env-1',
        repoUrl: 'https://github.com/openai/codex.git',
        branchName: 'feature/older',
        ref: 'main',
        model: 'gpt-5.2',
        reasoningEffort: 'high',
        status: 'completed',
        createdAt: '2024-01-01T12:00:00Z',
        runs: [],
        threadId: 'thread-1',
        useHostDockerSocket: false
      },
      {
        taskId: 'task-2',
        envId: 'env-2',
        repoUrl: 'https://github.com/openai/agents.git',
        branchName: 'feature/latest',
        ref: 'main',
        model: 'gpt-5.2',
        reasoningEffort: 'high',
        status: 'completed',
        createdAt: '2024-01-02T12:00:00Z',
        runs: [],
        threadId: 'thread-2',
        useHostDockerSocket: false
      }
    ];

    mockApi({
      '/api/envs': envs,
      '/api/tasks': tasks,
      '/api/accounts': { accounts: [], activeAccountId: null }
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'New task' }));

    const envSelect = await screen.findByLabelText('Environment');
    await user.click(envSelect);

    expect(await screen.findByRole('option', { name: 'openai/agents' }))
      .toHaveAttribute('aria-selected', 'true');
  },
  15000
);
