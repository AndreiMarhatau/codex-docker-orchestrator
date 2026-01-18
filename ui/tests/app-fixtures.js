const envs = [
  {
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    defaultBranch: 'main',
    envVars: { API_TOKEN: 'alpha', FEATURE_FLAG: 'true' }
  },
  {
    envId: 'env-2',
    repoUrl: 'https://github.com/openai/reference.git',
    defaultBranch: 'main',
    envVars: {}
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
    runs: [],
    threadId: 'thread-1',
    useHostDockerSocket: true,
    gitStatus: {
      hasChanges: false,
      pushed: true,
      dirty: false,
      diffStats: { additions: 0, deletions: 0 }
    }
  },
  {
    taskId: 'task-2',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'feature/stream',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'running',
    createdAt: '2024-01-02T12:00:00Z',
    runs: [{ runId: 'run-2', status: 'running', startedAt: '2024-01-02T12:00:00Z' }],
    threadId: 'thread-2',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 12, deletions: 4 }
    }
  }
];
const accounts = {
  activeAccountId: 'acct-1',
  accounts: [
    {
      id: 'acct-1',
      label: 'Primary',
      authJson: '{\n  "token": "primary"\n}',
      position: 1,
      isActive: true,
      createdAt: '2024-01-01T10:00:00Z'
    },
    {
      id: 'acct-2',
      label: 'Secondary',
      authJson: '{\n  "token": "secondary"\n}',
      position: 2,
      isActive: false,
      createdAt: '2024-01-01T11:00:00Z'
    }
  ]
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
      envId: 'env-2',
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
  attachments: [
    {
      name: 'requirements.txt',
      originalName: 'requirements.txt',
      path: '/tmp/task-uploads/requirements.txt',
      size: 240
    }
  ],
  gitStatus: {
    hasChanges: true,
    pushed: false,
    dirty: false,
    diffStats: { additions: 12, deletions: 4 }
  },
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
export { accounts, envs, rateLimits, taskDetail, taskDiff, tasks };
