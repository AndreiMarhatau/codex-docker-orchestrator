import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

const envs = [
  {
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    defaultBranch: 'main'
  }
];
const tasks = [
  {
    taskId: 'task-1',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'feature/refactor',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'completed',
    createdAt: '2024-01-02T12:00:00Z',
    runs: [
      {
        runId: 'run-1',
        status: 'completed',
        startedAt: '2024-01-02T12:00:00Z',
        finishedAt: '2024-01-02T12:05:00Z'
      }
    ],
    threadId: 'thread-1',
    useHostDockerSocket: true
  },
  {
    taskId: 'task-2',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'hotfix/urgent',
    ref: 'hotfix',
    model: '',
    reasoningEffort: '',
    status: 'running',
    createdAt: '2024-01-02T11:00:00Z',
    runs: [
      {
        runId: 'run-2',
        status: 'running',
        startedAt: '2024-01-02T11:00:00Z'
      }
    ],
    threadId: 'thread-2',
    useHostDockerSocket: false
  }
];
const accounts = {
  accounts: [
    {
      id: 'acct-1',
      label: 'Primary',
      position: 1,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'acct-2',
      label: 'Secondary',
      position: 2,
      isActive: false,
      createdAt: '2024-01-03T00:00:00Z'
    }
  ],
  activeAccountId: 'acct-1'
};
const taskDetail = {
  taskId: 'task-1',
  envId: 'env-1',
  repoUrl: 'https://github.com/openai/codex.git',
  branchName: 'feature/refactor',
  ref: 'main',
  model: 'gpt-5.2',
  reasoningEffort: 'high',
  status: 'completed',
  createdAt: '2024-01-02T12:00:00Z',
  threadId: 'thread-1',
  contextRepos: [
    {
      repoUrl: 'https://github.com/openai/reference.git',
      ref: 'dev',
      worktreePath: '/tmp/reference'
    }
  ],
  runLogs: [
    {
      runId: 'run-1',
      model: 'gpt-5.2',
      reasoningEffort: 'high',
      prompt: 'Do the thing',
      status: 'completed',
      startedAt: '2024-01-02T12:00:00Z',
      finishedAt: '2024-01-02T12:05:00Z',
      entries: [
        {
          id: 'entry-1',
          type: 'item.completed',
          parsed: {
            type: 'item.completed',
            item: { type: 'agent_message', text: 'Hello from agent' }
          },
          raw: 'raw entry'
        }
      ],
      artifacts: [
        { path: 'output.png', size: 2048 },
        { path: 'report.txt', size: 1024 }
      ]
    }
  ],
  gitStatus: { hasChanges: false, dirty: false },
  useHostDockerSocket: true
};
const taskDiff = {
  available: true,
  baseSha: 'abc123',
  files: [
    { path: 'src/app.js', lineCount: 5, tooLarge: false, diff: '+small diff' },
    { path: 'big/file.js', lineCount: 1200, tooLarge: true, diff: 'diff content' }
  ]
};
const rateLimits = {
  primary: {
    usedPercent: 30,
    windowDurationMins: 60,
    resetsAt: Math.floor(Date.now() / 1000) + 3600
  },
  secondary: {
    usedPercent: 50,
    windowDurationMins: 1440,
    resetsAt: Math.floor(Date.now() / 1000) + 7200
  },
  credits: { hasCredits: true, balance: '$20' },
  planType: 'team'
};
const imageInfo = {
  imageName: 'codex:latest',
  imageCreatedAt: '2024-01-01T00:00:00Z',
  imageId: 'sha256:abc123',
  present: true
};

function mockApi(responses) {
  global.fetch.mockImplementation(async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (options.method || 'GET').toUpperCase();
    const key = `${method} ${url}`;
    const response = responses[key] ?? responses[url];

    if (!response) {
      throw new Error(`Unhandled request: ${url}`);
    }

    if (response && typeof response === 'object' && response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    if (response.ok === false) {
      return {
        ok: false,
        status: response.status ?? 500,
        text: async () => response.text ?? 'Request failed.'
      };
    }

    return {
      ok: true,
      status: response.status ?? 200,
      json: async () => response.body ?? response
    };
  });
}

it(
  'renders the orchestrator sections and task details',
  async () => {
    mockApi({
      '/api/envs': envs,
      '/api/tasks': tasks,
      '/api/accounts': accounts,
      'POST /api/tasks': {},
      'POST /api/tasks/task-1/resume': {},
      'POST /api/tasks/task-1/push': {},
      'POST /api/tasks/task-2/stop': {},
      'DELETE /api/tasks/task-2': {},
      'DELETE /api/tasks/task-1': {},
      'DELETE /api/envs/env-1': {},
      'POST /api/accounts': accounts,
      'POST /api/accounts/rotate': accounts,
      'POST /api/accounts/acct-2/activate': accounts,
      'DELETE /api/accounts/acct-2': accounts,
      'POST /api/settings/image/pull': imageInfo,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      '/api/settings/image': imageInfo,
      [`/api/tasks/${taskDetail.taskId}`]: taskDetail,
      [`/api/tasks/${taskDetail.taskId}/diff`]: taskDiff
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByLabelText('Filter')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Environments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New task' }));
    expect(await screen.findByText('New task')).toBeInTheDocument();

    const environmentSelect = screen.getByLabelText('Environment');
    await user.click(environmentSelect);
    await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
    await user.type(screen.getByLabelText('Task prompt'), 'Refactor UI');

    const modelSelect = screen.getByLabelText('Model');
    await user.click(modelSelect);
    await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));

    const reasoningSelect = screen.getByLabelText('Reasoning effort');
    await user.click(reasoningSelect);
    await user.click(await screen.findByRole('option', { name: 'high' }));

    await user.click(modelSelect);
    await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
    await user.type(screen.getByLabelText('Custom model'), 'gpt-custom');
    await user.type(screen.getByLabelText('Custom reasoning effort'), 'xhigh');

    await user.click(screen.getByLabelText('Use host Docker socket'));

    await user.click(screen.getByRole('button', { name: 'Add reference repo' }));
    const envSelects = screen.getAllByLabelText('Environment');
    await user.click(envSelects[1]);
    await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
    const refInputs = screen.getAllByLabelText('Branch / tag / ref');
    await user.type(refInputs[1], 'dev');
    await user.click(screen.getByLabelText('Remove reference repo'));

    const fileInput = document.querySelector('input[type="file"]');
    const imageFile = new File(['image'], 'image.png', { type: 'image/png' });
    await user.upload(fileInput, [imageFile]);

    expect(await screen.findByText(/image.png/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear images' }));
    expect(screen.queryByText(/image.png/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run task' }));

    await user.click(screen.getByLabelText('Stop task task-2'));
    await user.click(screen.getByLabelText('Remove task task-2'));

    await user.click(screen.getByText('feature/refactor'));
    expect(await screen.findByText('Task details')).toBeInTheDocument();
    expect(screen.getByText('Agent messages')).toBeInTheDocument();
    expect(screen.getByText('output.png')).toBeInTheDocument();
    expect(screen.getByText('report.txt')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show diff' }));
    expect(screen.getByText('diff content')).toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    window.dispatchEvent(new Event('scroll'));
    await user.click(await screen.findByLabelText('Scroll to top'));

    const modelOverrideSelect = screen.getByLabelText('Model override');
    await user.click(modelOverrideSelect);
    await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));
    const resumeEffortSelect = screen.getByLabelText('Reasoning effort');
    await user.click(resumeEffortSelect);
    await user.click(await screen.findByRole('option', { name: 'high' }));

    await user.click(modelOverrideSelect);
    await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
    await user.type(screen.getByLabelText('Custom model'), 'resume-model');
    await user.type(screen.getByLabelText('Custom reasoning effort'), 'low');

    await user.type(screen.getByLabelText('Resume prompt'), 'Continue with more detail.');
    await user.click(screen.getByLabelText('Use host Docker socket for this run'));
    await user.click(screen.getByRole('button', { name: 'Continue task' }));
    await user.click(screen.getByRole('button', { name: 'Push' }));
    const removeTaskButtons = screen.getAllByLabelText('Remove task');
    await user.click(removeTaskButtons[removeTaskButtons.length - 1]);

    await user.click(screen.getByRole('tab', { name: 'Environments' }));
    expect(
      await screen.findByText('Create and manage repo sources for Codex runs.')
    ).toBeInTheDocument();
    expect(screen.getByText('1 environments')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await user.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(await screen.findByText('Usage limits')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Credits')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check usage limits' }));
    await user.click(screen.getByRole('button', { name: 'Rotate now' }));
    await user.click(screen.getByRole('button', { name: 'New account' }));
    await user.type(screen.getByLabelText('Account label'), 'Ops');
    fireEvent.change(screen.getByLabelText('auth.json contents'), {
      target: { value: '{"token":"x"}' }
    });
    await user.click(screen.getByRole('button', { name: 'Add account' }));
    const activateButtons = screen.getAllByRole('button', { name: 'Make active' });
    await user.click(activateButtons[activateButtons.length - 1]);
    const removeAccountButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeAccountButtons[removeAccountButtons.length - 1]);

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Codex Docker Image')).toBeInTheDocument();
    expect(screen.getByText('codex:latest')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update image' }));
  },
  30000
);

it(
  'surfaces empty states and errors',
  async () => {
    mockApi({
      '/api/envs': [],
      '/api/tasks': [],
      '/api/accounts': { accounts: [], activeAccountId: null },
      'POST /api/envs': {
        ok: false,
        status: 500,
        text: 'Failed to create environment.'
      },
      '/api/accounts/rate-limits': {
        rateLimits: {
          primary: null,
          secondary: null,
          credits: { hasCredits: false }
        },
        fetchedAt: ''
      },
      '/api/settings/image': {
        imageName: 'codex:latest',
        imageCreatedAt: '2024-01-01T00:00:00Z',
        imageId: '',
        present: false
      }
    });
    const user = userEvent.setup();
    render(<App />);

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
    expect(await screen.findByText('Image not found locally. Pull to download it.')).toBeInTheDocument();
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

    await user.click(await screen.findByText('feature/empty'));
    expect(await screen.findByText('No logs yet.')).toBeInTheDocument();
    expect(screen.getByText('Diff unavailable: no base')).toBeInTheDocument();
  },
  15000
);

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

    await user.click(await screen.findByText('feature/one-type'));
    expect(await screen.findByText('report.txt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
  },
  15000
);

it(
  'shows image loading state',
  async () => {
    mockApi({
      '/api/envs': envs,
      '/api/tasks': tasks,
      '/api/accounts': accounts,
      '/api/settings/image': {
        body: imageInfo,
        delay: 300
      }
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Loading image details...')).toBeInTheDocument();
  },
  15000
);
