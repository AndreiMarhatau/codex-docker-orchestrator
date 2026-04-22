/* eslint-disable complexity, max-lines, max-lines-per-function */
import { STATE_EVENT_TYPES } from '../app/state-event-types.js';
import { MOCK_NOW_ISO, createMockState } from './mockData.js';

const MOCK_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);
const MOCK_NOW_MS = Date.parse(MOCK_NOW_ISO);

function isMockPreviewEnabled() {
  const enableMockData = String(import.meta.env.VITE_ENABLE_MOCK_DATA || '').trim().toLowerCase();
  const legacyMockFlag = String(import.meta.env.VITE_MOCK_API || '').trim().toLowerCase();
  return MOCK_FLAG_VALUES.has(enableMockData) || MOCK_FLAG_VALUES.has(legacyMockFlag);
}

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function buildFetchResponse({ body, status = 200, text = '' }) {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (text || (body ? JSON.stringify(body) : ''))
  };
}

function parseJsonBody(body) {
  if (!body || typeof body !== 'string') {
    return body || {};
  }
  try {
    return JSON.parse(body);
  } catch (_error) {
    return {};
  }
}

function normalizeAccountPositions(state) {
  state.accounts.accounts = state.accounts.accounts.map((account, index) => ({
    ...account,
    isActive: index === 0,
    position: index + 1
  }));
  state.accounts.activeAccountId = state.accounts.accounts[0]?.id || null;
}

function buildStateSnapshot(state) {
  return {
    accounts: clone(state.accounts),
    envs: clone(state.envs),
    tasks: clone(state.tasks)
  };
}

function syncTaskSummary(state, taskId) {
  const detail = state.taskDetails[taskId];
  if (!detail) {
    state.tasks = state.tasks.filter((task) => task.taskId !== taskId);
    return;
  }
  const nextTask = {
    taskId: detail.taskId,
    envId: detail.envId,
    repoUrl: detail.repoUrl,
    branchName: detail.branchName,
    ref: detail.ref,
    model: detail.model,
    reasoningEffort: detail.reasoningEffort,
    status: detail.status,
    createdAt: detail.createdAt,
    runs: clone(detail.runLogs || []).map((run) => ({
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt
    })),
    threadId: detail.threadId,
    useHostDockerSocket: detail.useHostDockerSocket === true,
    gitStatus: clone(detail.gitStatus || null)
  };
  const existingIndex = state.tasks.findIndex((task) => task.taskId === taskId);
  if (existingIndex === -1) {
    state.tasks.unshift(nextTask);
    return;
  }
  state.tasks[existingIndex] = nextTask;
}

function computeUploadSize(body) {
  if (!body || typeof body.entries !== 'function') {
    return 0;
  }
  let total = 0;
  for (const [, value] of body.entries()) {
    if (value && typeof value.size === 'number') {
      total += value.size;
    }
  }
  return total;
}

function parseUploadEntries(state, body) {
  if (!body || typeof body.entries !== 'function') {
    return [];
  }
  const uploads = [];
  for (const [name, value] of body.entries()) {
    if (name !== 'files' || !value) {
      continue;
    }
    uploads.push({
      path: `/tmp/mock-uploads/${state.nextIds.upload}-${value.name || 'upload'}`,
      originalName: value.name || `upload-${state.nextIds.upload}`,
      size: typeof value.size === 'number' ? value.size : 0,
      mimeType: value.type || 'application/octet-stream'
    });
    state.nextIds.upload += 1;
  }
  return uploads;
}

function createTaskDetail(state, body) {
  const env = state.envs.find((entry) => entry.envId === body?.envId) || state.envs[0];
  const taskId = `task-${state.nextIds.task}`;
  state.nextIds.task += 1;
  const prompt = String(body?.prompt || 'New mock task').trim();
  const detail = {
    taskId,
    envId: env?.envId || '',
    repoUrl: env?.repoUrl || '',
    branchName: `preview/task-${taskId}`,
    ref: body?.ref || env?.defaultBranch || 'main',
    model: body?.model || 'gpt-5.2',
    reasoningEffort: body?.reasoningEffort || 'medium',
    status: 'queued',
    createdAt: MOCK_NOW_ISO,
    threadId: `thread-${taskId}`,
    contextRepos: [],
    runLogs: [
      {
        runId: `run-${taskId}`,
        model: body?.model || 'gpt-5.2',
        reasoningEffort: body?.reasoningEffort || 'medium',
        prompt,
        status: 'queued',
        startedAt: MOCK_NOW_ISO,
        entries: [
          {
            id: `entry-${taskId}-1`,
            type: 'item.completed',
            parsed: {
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: 'Mock mode accepted the task and queued a placeholder run.'
              }
            },
            raw: `entry-${taskId}-1`
          }
        ],
        artifacts: []
      }
    ],
    attachments: Array.isArray(body?.fileUploads)
      ? body.fileUploads.map((file, index) => ({
          name: file.originalName || `upload-${index + 1}`,
          originalName: file.originalName || `upload-${index + 1}`,
          path: file.path || `/tmp/mock-uploads/${index + 1}`,
          size: file.size || 0
        }))
      : [],
    gitStatus: {
      hasChanges: false,
      pushed: false,
      dirty: false,
      diffStats: { additions: 0, deletions: 0 }
    },
    useHostDockerSocket: body?.useHostDockerSocket === true
  };
  state.taskDetails[taskId] = detail;
  state.taskDiffs[taskId] = {
    available: false,
    reason: 'Diff will appear after the task finishes.'
  };
  syncTaskSummary(state, taskId);
  return detail;
}

function handleApiRequest(state, url, method, body) {
  const { pathname } = url;

  if (pathname === '/api/settings/password' && method === 'GET') {
    return { status: 200, body: { hasPassword: state.hasPassword } };
  }
  if (pathname === '/api/settings/password' && method === 'POST') {
    const password = String(body?.password || '').trim();
    if (!password) {
      return { status: 400, text: 'password is required' };
    }
    if (state.hasPassword && String(body?.currentPassword || '') !== state.password) {
      return { status: 401, text: 'Invalid password' };
    }
    state.hasPassword = true;
    state.password = password;
    return { status: 204 };
  }
  if (pathname === '/api/settings/auth' && method === 'POST') {
    if (state.hasPassword && String(body?.password || '') !== state.password) {
      return { status: 401, text: 'Invalid password' };
    }
    return { status: 204 };
  }
  if (pathname === '/api/settings/setup' && method === 'GET') {
    return { status: 200, body: clone(state.setupState) };
  }
  if (pathname === '/api/settings/config' && method === 'GET') {
    return { status: 200, body: { content: state.configContent } };
  }
  if (pathname === '/api/settings/config' && method === 'POST') {
    state.configContent = String(body?.content || '');
    return { status: 204 };
  }
  if (pathname === '/api/settings/git' && method === 'POST') {
    state.setupState.gitTokenConfigured = Boolean(String(body?.token || '').trim());
    return { status: 200, body: clone(state.setupState) };
  }
  if (pathname === '/api/accounts' && method === 'GET') {
    return { status: 200, body: clone(state.accounts) };
  }
  if (pathname === '/api/accounts/rate-limits' && method === 'GET') {
    return {
      status: 200,
      body: {
        rateLimits: clone(state.rateLimits),
        fetchedAt: MOCK_NOW_ISO
      }
    };
  }
  if (pathname === '/api/accounts/trigger-usage' && method === 'POST') {
    return { status: 200, body: { triggeredAt: MOCK_NOW_ISO } };
  }
  if (pathname === '/api/accounts' && method === 'POST') {
    state.accounts.accounts.push({
      id: `acct-${state.nextIds.account}`,
      label: String(body?.label || `Mock Account ${state.nextIds.account}`),
      authJson: String(body?.authJson || '{\n  "token": "mock"\n}'),
      position: state.accounts.accounts.length + 1,
      isActive: false,
      createdAt: MOCK_NOW_ISO
    });
    state.nextIds.account += 1;
    normalizeAccountPositions(state);
    return { status: 201, body: clone(state.accounts) };
  }
  if (pathname === '/api/accounts/rotate' && method === 'POST') {
    const [first, ...rest] = state.accounts.accounts;
    state.accounts.accounts = [...rest, first].filter(Boolean);
    normalizeAccountPositions(state);
    return { status: 200, body: clone(state.accounts) };
  }
  const activateAccountMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/activate$/);
  if (activateAccountMatch && method === 'POST') {
    const accountId = activateAccountMatch[1];
    const selected = state.accounts.accounts.find((entry) => entry.id === accountId);
    if (!selected) {
      return { status: 404, text: 'Account not found' };
    }
    state.accounts.accounts = [
      selected,
      ...state.accounts.accounts.filter((entry) => entry.id !== accountId)
    ];
    normalizeAccountPositions(state);
    return { status: 200, body: clone(state.accounts) };
  }
  const accountAuthMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/auth-json$/);
  if (accountAuthMatch && method === 'PATCH') {
    const account = state.accounts.accounts.find((entry) => entry.id === accountAuthMatch[1]);
    if (!account) {
      return { status: 404, text: 'Account not found' };
    }
    account.authJson = String(body?.authJson || account.authJson);
    return { status: 200, body: clone(state.accounts) };
  }
  const accountMatch = pathname.match(/^\/api\/accounts\/([^/]+)$/);
  if (accountMatch && method === 'PATCH') {
    const account = state.accounts.accounts.find((entry) => entry.id === accountMatch[1]);
    if (!account) {
      return { status: 404, text: 'Account not found' };
    }
    account.label = String(body?.label || account.label);
    return { status: 200, body: clone(state.accounts) };
  }
  if (accountMatch && method === 'DELETE') {
    state.accounts.accounts = state.accounts.accounts.filter((entry) => entry.id !== accountMatch[1]);
    normalizeAccountPositions(state);
    return { status: 200, body: clone(state.accounts) };
  }
  if (pathname === '/api/envs' && method === 'GET') {
    return { status: 200, body: clone(state.envs) };
  }
  if (pathname === '/api/envs' && method === 'POST') {
    const env = {
      envId: `env-${state.nextIds.env}`,
      repoUrl: String(body?.repoUrl || 'https://github.com/example/mock-repo.git'),
      defaultBranch: String(body?.defaultBranch || 'main'),
      envVars: clone(body?.envVars || {})
    };
    state.nextIds.env += 1;
    state.envs.push(env);
    return { status: 201, body: clone(env) };
  }
  const envMatch = pathname.match(/^\/api\/envs\/([^/]+)$/);
  if (envMatch && method === 'PATCH') {
    const env = state.envs.find((entry) => entry.envId === envMatch[1]);
    if (!env) {
      return { status: 404, text: 'Environment not found' };
    }
    if (body?.defaultBranch !== undefined) {
      env.defaultBranch = String(body.defaultBranch || env.defaultBranch);
    }
    if (body?.envVars !== undefined) {
      env.envVars = clone(body.envVars || {});
    }
    return { status: 200, body: clone(env) };
  }
  if (envMatch && method === 'DELETE') {
    state.envs = state.envs.filter((entry) => entry.envId !== envMatch[1]);
    return { status: 204 };
  }
  if (pathname === '/api/tasks' && method === 'GET') {
    return { status: 200, body: clone(state.tasks) };
  }
  if (pathname === '/api/tasks' && method === 'POST') {
    const detail = createTaskDetail(state, body);
    return { status: 201, body: clone(detail) };
  }
  const taskDiffMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/diff$/);
  if (taskDiffMatch && method === 'GET') {
    const diff = state.taskDiffs[taskDiffMatch[1]];
    if (!diff) {
      return { status: 404, text: 'Task not found' };
    }
    return { status: 200, body: clone(diff) };
  }
  const taskResumeMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/resume$/);
  if (taskResumeMatch && method === 'POST') {
    const taskId = taskResumeMatch[1];
    const detail = state.taskDetails[taskId];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    const attachmentRemovals = Array.isArray(body?.attachmentRemovals)
      ? new Set(body.attachmentRemovals)
      : new Set();
    const retainedAttachments = Array.isArray(detail.attachments)
      ? detail.attachments.filter((file) => !attachmentRemovals.has(file.name))
      : [];
    const uploadedAttachments = Array.isArray(body?.fileUploads)
      ? body.fileUploads.map((file, index) => ({
          name: file.originalName || `resume-upload-${index + 1}`,
          originalName: file.originalName || `resume-upload-${index + 1}`,
          path: file.path || `/tmp/mock-uploads/resume-${index + 1}`,
          size: file.size || 0
        }))
      : [];
    detail.attachments = [...retainedAttachments, ...uploadedAttachments];
    detail.status = 'completed';
    detail.runLogs.push({
      runId: `run-${taskId}-resume`,
      model: body?.model || detail.model,
      reasoningEffort: body?.reasoningEffort || detail.reasoningEffort,
      prompt: String(body?.prompt || 'Follow-up request'),
      status: 'completed',
      startedAt: MOCK_NOW_ISO,
      finishedAt: MOCK_NOW_ISO,
      entries: [
        {
          id: `entry-${taskId}-resume`,
          type: 'item.completed',
          parsed: {
            type: 'item.completed',
            item: {
              type: 'agent_message',
              text: 'Mock resume completed immediately for preview purposes.'
            }
          },
          raw: `entry-${taskId}-resume`
        }
      ],
      artifacts: []
    });
    detail.gitStatus = {
      hasChanges: true,
      pushed: false,
      dirty: false,
      diffStats: { additions: 7, deletions: 1 }
    };
    syncTaskSummary(state, taskId);
    return { status: 200, body: clone(detail) };
  }
  const taskStopMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/stop$/);
  if (taskStopMatch && method === 'POST') {
    const taskId = taskStopMatch[1];
    const detail = state.taskDetails[taskId];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    detail.status = 'stopped';
    syncTaskSummary(state, taskId);
    return { status: 200, body: clone(state.tasks.find((task) => task.taskId === taskId)) };
  }
  const taskPushMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/push$/);
  if (taskPushMatch && method === 'POST') {
    const taskId = taskPushMatch[1];
    const detail = state.taskDetails[taskId];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    detail.gitStatus = {
      hasChanges: false,
      pushed: true,
      dirty: false,
      diffStats: { additions: 0, deletions: 0 }
    };
    syncTaskSummary(state, taskId);
    return { status: 200, body: { pushed: true } };
  }
  const taskAttachmentMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/attachments$/);
  if (taskAttachmentMatch && method === 'POST') {
    const detail = state.taskDetails[taskAttachmentMatch[1]];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    const attachments = parseUploadEntries(state, body).map((upload) => ({
      name: upload.originalName,
      originalName: upload.originalName,
      path: upload.path,
      size: upload.size
    }));
    detail.attachments = [...detail.attachments, ...attachments];
    return { status: 201, body: { attachments: clone(detail.attachments) } };
  }
  if (taskAttachmentMatch && method === 'DELETE') {
    const detail = state.taskDetails[taskAttachmentMatch[1]];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    const names = Array.isArray(body?.names) ? body.names : [];
    detail.attachments = detail.attachments.filter((attachment) => !names.includes(attachment.name));
    return { status: 200, body: { attachments: clone(detail.attachments) } };
  }
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && method === 'GET') {
    const detail = state.taskDetails[taskMatch[1]];
    if (!detail) {
      return { status: 404, text: 'Task not found' };
    }
    return { status: 200, body: clone(detail) };
  }
  if (taskMatch && method === 'DELETE') {
    delete state.taskDetails[taskMatch[1]];
    delete state.taskDiffs[taskMatch[1]];
    state.tasks = state.tasks.filter((task) => task.taskId !== taskMatch[1]);
    return { status: 204 };
  }
  if (pathname === '/api/uploads/files' && method === 'POST') {
    const uploads = parseUploadEntries(state, body);
    state.uploads = uploads;
    return { status: 200, body: { uploads } };
  }
  return { status: 404, text: `Unhandled mock request: ${method} ${pathname}` };
}

function createMockXmlHttpRequest(state, OriginalXMLHttpRequest) {
  return class MockXMLHttpRequest {
    constructor() {
      this.headers = {};
      this.method = 'GET';
      this.responseText = '';
      this.status = 0;
      this.url = '';
      this.upload = {
        addEventListener: (event, handler) => {
          if (event === 'progress') {
            this.uploadProgressHandler = handler;
          }
        }
      };
      this.fallback = null;
      this.usingFallback = false;
    }

    open(method, url) {
      this.method = String(method || 'GET').toUpperCase();
      this.url = url;
      const parsedUrl = new URL(url, window.location.origin);
      if (!parsedUrl.pathname.startsWith('/api/')) {
        this.usingFallback = true;
        this.fallback = new OriginalXMLHttpRequest();
        this.fallback.onload = () => {
          this.status = this.fallback.status;
          this.responseText = this.fallback.responseText;
          this.onload?.();
        };
        this.fallback.onerror = (error) => {
          this.onerror?.(error);
        };
        this.fallback.open(method, url);
      }
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
      if (this.usingFallback && this.fallback) {
        this.fallback.setRequestHeader(name, value);
      }
    }

    send(body) {
      if (this.usingFallback && this.fallback) {
        this.fallback.send(body);
        return;
      }
      const total = computeUploadSize(body);
      if (this.uploadProgressHandler && total > 0) {
        this.uploadProgressHandler({
          lengthComputable: true,
          loaded: Math.round(total / 2),
          total
        });
      }
      const result = handleApiRequest(
        state,
        new URL(this.url, window.location.origin),
        this.method,
        body
      );
      if (this.uploadProgressHandler) {
        this.uploadProgressHandler({
          lengthComputable: total > 0,
          loaded: total,
          total
        });
      }
      this.status = result.status;
      this.responseText = result.text || JSON.stringify(result.body || {});
      this.onload?.();
    }
  };
}

function createMockEventSource(state) {
  return class MockEventSource {
    constructor(url) {
      this.url = url;
      this.closed = false;
      this.listeners = new Map();
      window.setTimeout(() => {
        if (this.closed) {
          return;
        }
        const parsedUrl = new URL(url, window.location.origin);
        if (parsedUrl.pathname === '/api/events/stream') {
          this.dispatch(STATE_EVENT_TYPES.init, buildStateSnapshot(state));
        }
      }, 0);
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      this.listeners.set(
        type,
        listeners.filter((entry) => entry !== listener)
      );
    }

    dispatch(type, payload) {
      const event = { data: JSON.stringify(payload), type };
      const listeners = this.listeners.get(type) || [];
      listeners.forEach((listener) => listener(event));
      if (type === 'message' && typeof this.onmessage === 'function') {
        this.onmessage(event);
      }
    }

    close() {
      this.closed = true;
      this.listeners.clear();
    }
  };
}

function installMockApi() {
  if (typeof window === 'undefined' || !isMockPreviewEnabled()) {
    return false;
  }
  if (window.__ORCH_MOCK_API_INSTALLED__) {
    return true;
  }
  const originalDateNow = Date.now.bind(Date);
  const originalFetch = window.fetch.bind(window);
  const originalXmlHttpRequest = window.XMLHttpRequest;
  const state = createMockState();

  Date.now = () => MOCK_NOW_MS;

  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!url.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }
    const method = String(init.method || 'GET').toUpperCase();
    const body = parseJsonBody(init.body);
    return buildFetchResponse(handleApiRequest(state, url, method, body));
  };
  window.XMLHttpRequest = createMockXmlHttpRequest(state, originalXmlHttpRequest);
  window.EventSource = createMockEventSource(state);
  window.__ORCH_MOCK_API_INSTALLED__ = true;
  window.__ORCH_MOCK_API_STATE__ = state;
  window.__ORCH_MOCK_API_RESTORE_NOW__ = () => {
    Date.now = originalDateNow;
  };
  return true;
}

export { installMockApi, isMockPreviewEnabled };
