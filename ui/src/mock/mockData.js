/* eslint-disable max-lines */
const MOCK_NOW_ISO = '2026-04-17T09:00:00.000Z';
const MOCK_NOW_MS = Date.parse(MOCK_NOW_ISO);
const RUNNING_TASK_PRIMARY_STARTED_AT = new Date(MOCK_NOW_MS - 18 * 60 * 1000).toISOString();
const RUNNING_TASK_SECONDARY_STARTED_AT = new Date(MOCK_NOW_MS - 84 * 60 * 1000).toISOString();

function createDataUrl(mimeType, content) {
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
}

function createSvgArtifactUrl(title, accentColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
      <rect width="1280" height="800" fill="#0f172a" />
      <rect x="64" y="64" width="1152" height="672" rx="28" fill="#111827" stroke="${accentColor}" stroke-width="8" />
      <rect x="120" y="136" width="520" height="44" rx="12" fill="${accentColor}" opacity="0.9" />
      <rect x="120" y="212" width="1040" height="20" rx="10" fill="#334155" />
      <rect x="120" y="252" width="880" height="20" rx="10" fill="#334155" />
      <rect x="120" y="338" width="480" height="260" rx="20" fill="#1e293b" />
      <rect x="636" y="338" width="524" height="260" rx="20" fill="#1e293b" />
      <text x="120" y="110" fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="52" font-weight="700">${title}</text>
      <text x="120" y="662" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="28">Mock artifact preview rendered entirely in-browser.</text>
    </svg>
  `.trim();
  return createDataUrl('image/svg+xml', svg);
}

const setupState = {
  ready: true,
  gitTokenConfigured: true,
  accountConfigured: true,
  gitUserName: 'Codex Agent',
  gitUserEmail: 'codex@openai.com'
};

const envs = [
  {
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    defaultBranch: 'main',
    envVars: {
      OPENAI_API_KEY: 'preview-key',
      FEATURE_FLAG: 'enabled'
    }
  },
  {
    envId: 'env-2',
    repoUrl: 'https://github.com/openai/openai-python.git',
    defaultBranch: 'main',
    envVars: {
      SDK_MODE: 'preview'
    }
  },
  {
    envId: 'env-3',
    repoUrl: 'https://github.com/openai/evals.git',
    defaultBranch: 'main',
    envVars: {}
  }
];

const tasks = [
  {
    taskId: 'task-1',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/ui-refresh',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'running',
    createdAt: '2024-05-12T22:42:00Z',
    runs: [
      {
        runId: 'run-1',
        status: 'completed',
        startedAt: '2024-05-12T22:42:00Z',
        finishedAt: '2024-05-12T22:44:00Z'
      },
      {
        runId: 'run-2',
        status: 'running',
        startedAt: RUNNING_TASK_PRIMARY_STARTED_AT
      }
    ],
    threadId: 'thread-1',
    useHostDockerSocket: true,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 1831, deletions: 607 }
    }
  },
  {
    taskId: 'task-2',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/fix-auth-flow',
    ref: 'main',
    model: 'gpt-5.3-codex',
    reasoningEffort: 'medium',
    status: 'stopped',
    createdAt: '2024-05-12T22:05:00Z',
    runs: [],
    threadId: 'thread-2',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 42, deletions: 10 }
    }
  },
  {
    taskId: 'task-3',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/api-pagination',
    ref: 'main',
    model: 'gpt-5.2-codex',
    reasoningEffort: 'medium',
    status: 'completed',
    createdAt: '2024-05-12T21:20:00Z',
    runs: [],
    threadId: 'thread-3',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: true,
      dirty: false,
      diffStats: { additions: 120, deletions: 33 }
    }
  },
  {
    taskId: 'task-4',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/db-migration',
    ref: 'main',
    model: 'gpt-5.1-codex-mini',
    reasoningEffort: 'low',
    status: 'failed',
    createdAt: '2024-05-12T20:02:00Z',
    runs: [],
    threadId: 'thread-4',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 8, deletions: 2 }
    }
  },
  {
    taskId: 'task-5',
    envId: 'env-2',
    repoUrl: 'https://github.com/openai/openai-python.git',
    branchName: 'feat/streaming-retry',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'medium',
    status: 'running',
    createdAt: '2024-05-12T19:12:00Z',
    runs: [
      {
        runId: 'run-5',
        status: 'running',
        startedAt: RUNNING_TASK_SECONDARY_STARTED_AT
      }
    ],
    threadId: 'thread-5',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 311, deletions: 98 }
    }
  },
  {
    taskId: 'task-6',
    envId: 'env-3',
    repoUrl: 'https://github.com/openai/evals.git',
    branchName: 'chore/update-eval',
    ref: 'main',
    model: 'gpt-5.1-codex-mini',
    reasoningEffort: 'low',
    status: 'stopped',
    createdAt: '2024-05-12T18:18:00Z',
    runs: [],
    threadId: 'thread-6',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: true,
      dirty: false,
      diffStats: { additions: 5, deletions: 1 }
    }
  }
];

const accounts = {
  activeAccountId: 'acct-1',
  accounts: [
    {
      id: 'acct-1',
      label: 'Primary Team',
      authJson: '{\n  "token": "primary-team"\n}',
      position: 1,
      isActive: true,
      createdAt: '2026-04-01T10:00:00Z'
    },
    {
      id: 'acct-2',
      label: 'Backup Personal',
      authJson: '{\n  "token": "backup-personal"\n}',
      position: 2,
      isActive: false,
      createdAt: '2026-04-01T11:00:00Z'
    },
    {
      id: 'acct-3',
      label: 'CI Robot',
      authJson: '{\n  "token": "ci-robot"\n}',
      position: 3,
      isActive: false,
      createdAt: '2026-04-01T12:00:00Z'
    }
  ]
};

const taskDetails = {
  'task-1': {
    taskId: 'task-1',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/ui-refresh',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'running',
    createdAt: '2024-05-12T22:42:00Z',
    threadId: 'thread-1',
    contextRepos: [],
    runLogs: [
      {
        runId: 'run-1',
        model: 'gpt-5.2',
        reasoningEffort: 'high',
        prompt: 'What time is it?',
        status: 'completed',
        startedAt: '2024-05-12T22:42:00Z',
        finishedAt: '2024-05-12T22:44:00Z',
        entries: [
          {
            id: 'entry-1',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'exec_command',
                text: 'Executed: date'
              }
            },
            raw: 'entry-1'
          },
          {
            id: 'entry-1b',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'tool_call',
                text: 'Read file\ncat /etc/timezone'
              }
            },
            raw: 'entry-1b'
          },
          {
            id: 'entry-1c',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: 'The current time is 3:42 PM (America/Los_Angeles).'
              }
            },
            raw: 'entry-1c'
          },
        ],
        artifacts: []
      },
      {
        runId: 'run-2',
        model: 'gpt-5.2',
        reasoningEffort: 'high',
        prompt: 'Also update the header to use the new brand color.',
        status: 'running',
        startedAt: RUNNING_TASK_PRIMARY_STARTED_AT,
        entries: [
          {
            id: 'entry-2b',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: 'Updated the header component to use the new brand color across all breakpoints.'
              }
            },
            raw: 'entry-2b'
          }
        ],
        artifacts: []
      }
    ],
    attachments: [],
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 1831, deletions: 607 }
    },
    useHostDockerSocket: true
  },
  'task-2': {
    taskId: 'task-2',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/fix-auth-flow',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'medium',
    status: 'running',
    createdAt: '2026-04-17T08:40:00Z',
    threadId: 'thread-2',
    contextRepos: [],
    runLogs: [
      {
        runId: 'run-2',
        model: 'gpt-5.2',
        reasoningEffort: 'medium',
        prompt: 'Polish spacing and controls for the mobile task experience.',
        status: 'running',
        startedAt: '2026-04-17T08:40:00Z',
        entries: [],
        artifacts: []
      }
    ],
    attachments: [],
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 18, deletions: 6 }
    },
    useHostDockerSocket: false
  },
  'task-3': {
    taskId: 'task-3',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/api-pagination',
    ref: 'main',
    model: 'gpt-5.2-codex',
    reasoningEffort: 'medium',
    status: 'completed',
    createdAt: '2024-05-12T21:20:00Z',
    threadId: 'thread-3',
    contextRepos: [
      {
        envId: 'env-2',
        repoUrl: 'https://github.com/openai/openai-python.git',
        ref: 'main',
        worktreePath: '/workspace/reference/openai-python'
      }
    ],
    runLogs: [],
    attachments: [
      {
        name: 'settings-note.md',
        originalName: 'settings-note.md',
        path: '/tmp/task-uploads/settings-note.md',
        size: 918
      }
    ],
    gitStatus: {
      hasChanges: true,
      pushed: true,
      dirty: false,
      diffStats: { additions: 120, deletions: 33 }
    },
    useHostDockerSocket: false
  },
  'task-4': {
    taskId: 'task-4',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'codex/db-migration',
    ref: 'main',
    model: 'gpt-5.1-codex-mini',
    reasoningEffort: 'low',
    status: 'failed',
    createdAt: '2024-05-12T20:02:00Z',
    threadId: 'thread-4',
    contextRepos: [],
    runLogs: [
      {
        runId: 'run-4',
        model: 'gpt-5.1-codex-mini',
        reasoningEffort: 'low',
        prompt: 'Collect migration diagnostics.',
        status: 'failed',
        startedAt: '2024-05-12T20:02:00Z',
        finishedAt: '2024-05-12T20:04:00Z',
        entries: [],
        artifacts: [
          {
            path: 'screenshots/desktop-tasks.png',
            size: 189743,
            url: createSvgArtifactUrl('Desktop Task Board', '#38bdf8')
          },
          {
            path: 'screenshots/mobile-task-detail.png',
            size: 112204,
            url: createSvgArtifactUrl('Mobile Task Detail', '#22c55e')
          },
          {
            path: 'notes/mock-preview.md',
            size: 3211,
            url: createDataUrl(
              'text/markdown',
              '# Mock preview\n\nThis artifact is bundled with the mock UI so designers can open it without a backend.'
            )
          }
        ]
      }
    ],
    attachments: [],
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: true,
      diffStats: { additions: 8, deletions: 2 }
    },
    useHostDockerSocket: false
  }
};

const taskDiffs = {
  'task-1': {
    available: true,
    baseSha: '9d2f341',
    files: [
      {
        path: 'ui/src/main.jsx',
        lineCount: 18,
        tooLarge: false,
        diff: `+import { installMockApi } from './mock/mockApi.js';\n+\n+installMockApi();`
      },
      {
        path: 'bin/ui-mock-screenshots',
        lineCount: 27,
        tooLarge: false,
        diff: `+playwright screenshot --viewport-size 1440,1200 "$base_url/?tab=tasks" "$output_dir/desktop/tasks.png"\n+playwright screenshot --device "iPhone 13" "$base_url/?tab=tasks&taskId=task-1" "$output_dir/mobile/task-detail.png"`
      }
    ]
  },
  'task-2': {
    available: false,
    reason: 'Diff not ready while the task is still running.'
  },
  'task-3': {
    available: false,
    reason: 'No diff was produced for this task.'
  }
};

const rateLimits = {
  primary: {
    usedPercent: 34,
    windowDurationMins: 60,
    resetsAt: 1776430800
  },
  secondary: {
    usedPercent: 58,
    windowDurationMins: 1440,
    resetsAt: 1776463200
  },
  credits: {
    hasCredits: true,
    balance: '$52'
  },
  planType: 'team'
};

const configContent = `model = "gpt-5.2"\nreasoning_effort = "high"\n\n[profiles.design]\nmodel = "gpt-5.2"\nreasoning_effort = "medium"\n`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMockState() {
  return {
    accounts: clone(accounts),
    configContent,
    envs: clone(envs),
    hasPassword: false,
    nextIds: {
      account: 4,
      env: 4,
      task: 4,
      upload: 1
    },
    password: '',
    rateLimits: clone(rateLimits),
    setupState: clone(setupState),
    taskDetails: clone(taskDetails),
    taskDiffs: clone(taskDiffs),
    tasks: clone(tasks),
    uploads: []
  };
}

export {
  MOCK_NOW_ISO,
  createMockState
};
