/* eslint-disable max-lines */
const MOCK_NOW_ISO = '2026-04-17T09:00:00.000Z';

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
    repoUrl: 'https://github.com/openai/openai-cookbook.git',
    defaultBranch: 'main',
    envVars: {
      DOCS_MODE: 'preview'
    }
  },
  {
    envId: 'env-3',
    repoUrl: 'https://github.com/acme/internal-dashboard.git',
    defaultBranch: 'develop',
    envVars: {}
  }
];

const tasks = [
  {
    taskId: 'task-1',
    envId: 'env-1',
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: 'feature/mock-preview',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'completed',
    createdAt: '2026-04-17T08:20:00Z',
    runs: [],
    threadId: 'thread-1',
    useHostDockerSocket: true,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 42, deletions: 11 }
    }
  },
  {
    taskId: 'task-2',
    envId: 'env-2',
    repoUrl: 'https://github.com/openai/openai-cookbook.git',
    branchName: 'design/mobile-polish',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'medium',
    status: 'running',
    createdAt: '2026-04-17T08:40:00Z',
    runs: [
      {
        runId: 'run-2',
        status: 'running',
        startedAt: '2026-04-17T08:40:00Z'
      }
    ],
    threadId: 'thread-2',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 18, deletions: 6 }
    }
  },
  {
    taskId: 'task-3',
    envId: 'env-3',
    repoUrl: 'https://github.com/acme/internal-dashboard.git',
    branchName: 'chore/settings-copy',
    ref: 'develop',
    model: 'gpt-5.1-codex-mini',
    reasoningEffort: 'low',
    status: 'failed',
    createdAt: '2026-04-16T18:05:00Z',
    runs: [],
    threadId: 'thread-3',
    useHostDockerSocket: false,
    gitStatus: {
      hasChanges: false,
      pushed: true,
      dirty: false,
      diffStats: { additions: 0, deletions: 0 }
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
    branchName: 'feature/mock-preview',
    ref: 'main',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'completed',
    createdAt: '2026-04-17T08:20:00Z',
    threadId: 'thread-1',
    contextRepos: [
      {
        envId: 'env-2',
        repoUrl: 'https://github.com/openai/openai-cookbook.git',
        ref: 'main',
        worktreePath: '/workspace/openai-cookbook'
      }
    ],
    runLogs: [
      {
        runId: 'run-1',
        model: 'gpt-5.2',
        reasoningEffort: 'high',
        prompt: 'Create a mock preview mode for the UI and make it screenshot friendly.',
        status: 'completed',
        startedAt: '2026-04-17T08:20:00Z',
        finishedAt: '2026-04-17T08:44:00Z',
        entries: [
          {
            id: 'entry-1',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: 'Mapped the UI entrypoints and identified a frontend-only mock mode as the lowest-friction path.'
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
                text: 'Scanned the app shell, task surfaces, and screenshot script to map layout breakpoints.'
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
                type: 'exec_command',
                text: 'Ran the mock screenshot flow and compared desktop/mobile captures to spot overflow and hierarchy failures.'
              }
            },
            raw: 'entry-1c'
          },
          {
            id: 'entry-2',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: 'Added deterministic screen URLs so desktop and mobile screenshots can be automated.'
              }
            },
            raw: 'entry-2'
          },
          {
            id: 'entry-2b',
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'tool_call',
                text: 'Reworked the board and detail shell into a shared two-surface layout with collapsed secondary sections.'
              }
            },
            raw: 'entry-2b'
          }
        ],
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
    attachments: [
      {
        name: 'design-brief.md',
        originalName: 'design-brief.md',
        path: '/tmp/mock/design-brief.md',
        size: 2401
      },
      {
        name: 'wireframe.png',
        originalName: 'wireframe.png',
        path: '/tmp/mock/wireframe.png',
        size: 48213
      }
    ],
    gitStatus: {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 42, deletions: 11 }
    },
    useHostDockerSocket: true
  },
  'task-2': {
    taskId: 'task-2',
    envId: 'env-2',
    repoUrl: 'https://github.com/openai/openai-cookbook.git',
    branchName: 'design/mobile-polish',
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
    envId: 'env-3',
    repoUrl: 'https://github.com/acme/internal-dashboard.git',
    branchName: 'chore/settings-copy',
    ref: 'develop',
    model: 'gpt-5.1-codex-mini',
    reasoningEffort: 'low',
    status: 'failed',
    createdAt: '2026-04-16T18:05:00Z',
    threadId: 'thread-3',
    contextRepos: [
      {
        envId: 'env-2',
        repoUrl: 'https://github.com/openai/openai-cookbook.git',
        ref: 'release/docs',
        worktreePath: '/workspace/reference/openai-cookbook'
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
    error: 'Task failed before codex-docker spawned.',
    gitStatus: {
      hasChanges: false,
      pushed: true,
      dirty: false,
      diffStats: { additions: 0, deletions: 0 }
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
