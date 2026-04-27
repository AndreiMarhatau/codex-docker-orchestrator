import path from 'node:path';
import fsSync from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

export const defaultRateLimits = {
  primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1730947200 },
  secondary: null,
  credits: null,
  planType: null
};

export function createChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => {
    setImmediate(() => {
      child.emit('close', 143, 'SIGTERM');
    });
  };
  return child;
}

function resolveMountedPath(options, targetPath) {
  const mounts = String(options?.env?.CODEX_VOLUME_MOUNTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const match = mounts.find((entry) => entry.includes(`=${targetPath}`) || entry.includes(`=${targetPath}:ro`));
  if (!match) {
    return null;
  }
  const [source] = match.split('=');
  const slashIndex = source.indexOf('/');
  const root = options?.env?.ORCH_DATA_DIR;
  return slashIndex === -1 || !root ? null : path.join(root, source.slice(slashIndex + 1));
}

function getRateLimitsForOptions(options, rateLimitsByToken) {
  try {
    const codexHome = resolveMountedPath(options, '/root/.codex');
    const authPath = path.join(codexHome, 'auth.json');
    const auth = JSON.parse(fsSync.readFileSync(authPath, 'utf8'));
    return rateLimitsByToken[auth.token] || defaultRateLimits;
  } catch (error) {
    return defaultRateLimits;
  }
}

function persistRefreshedAuth(options, config) {
  const codexHome = resolveMountedPath(options, '/root/.codex');
  if (!(config.refreshedAuthByToken || config.refreshedAuthRawByToken) || !codexHome) {
    return;
  }
  try {
    const authPath = path.join(codexHome, 'auth.json');
    const auth = JSON.parse(fsSync.readFileSync(authPath, 'utf8'));
    const updatedAuthRaw = config.refreshedAuthRawByToken?.[auth.token];
    const updatedAuth = config.refreshedAuthByToken?.[auth.token];
    if (typeof updatedAuthRaw === 'string') {
      fsSync.writeFileSync(authPath, updatedAuthRaw);
    } else if (updatedAuth) {
      fsSync.writeFileSync(authPath, JSON.stringify(updatedAuth, null, 2));
    }
  } catch (error) {
    // Ignore mock refresh persistence failures in tests.
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function emitCompletedTurn(context, { status = 'completed', text = 'OK', error = null }) {
  context.turnCount += 1;
  const turnId = `turn-${context.turnCount}`;
  const item = { id: `item-${context.turnCount}`, type: 'agentMessage', text };
  setImmediate(() => {
    context.write({
      method: 'turn/started',
      params: { turn: { id: turnId, status: 'inProgress', items: [] } }
    });
    if (status === 'completed') {
      context.write({ method: 'item/completed', params: { item } });
    }
    context.write({
      method: 'turn/completed',
      params: { turn: { id: turnId, status, items: status === 'completed' ? [item] : [], error } }
    });
  });
  return turnId;
}

function handleThread(context, message, resume) {
  if (resume) {
    context.threadId = message.params?.threadId || context.threadId;
  }
  const thread = { id: context.threadId, status: 'loaded', turns: [] };
  context.write({
    id: message.id,
    result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' }
  });
  context.write({ method: 'thread/started', params: { thread } });
}

function responseTextForPrompt(text) {
  if (text.includes('branch name')) {
    return JSON.stringify({ branchName: 'codex/mock-branch' });
  }
  if (text.includes('commit message')) {
    return JSON.stringify({ message: 'Update mock task' });
  }
  return 'OK';
}

function handleTurnStart(context, message) {
  const text = message.params?.input?.[0]?.text || '';
  Promise.resolve(context.config.consumeUsageLimit?.()).then((usageLimited) => {
    const status = usageLimited ? 'failed' : 'completed';
    const error = status === 'failed' ? { message: "You've hit your usage limit." } : null;
    const turnId = emitCompletedTurn(context, { status, text: responseTextForPrompt(text), error });
    context.write({
      id: message.id,
      result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } }
    });
  });
}

function handleMessage(context, message) {
  if (message && context.call) {
    context.call.messages.push(message);
  }
  if (message?.method === 'initialize' && message.id !== undefined) {
    context.write({ id: message.id, result: { userAgent: 'codex-mock' } });
  } else if (message?.method === 'account/rateLimits/read' && message.id !== undefined) {
    persistRefreshedAuth(context.options, context.config);
    context.write({
      id: message.id,
      result: { rateLimits: getRateLimitsForOptions(context.options, context.config.rateLimitsByToken) }
    });
    context.child.stdout.end();
    context.child.emit('close', 0, null);
  } else if (message?.method === 'thread/start' && message.id !== undefined) {
    handleThread(context, message, false);
  } else if (message?.method === 'thread/resume' && message.id !== undefined) {
    handleThread(context, message, true);
  } else if (message?.method === 'turn/start' && message.id !== undefined) {
    handleTurnStart(context, message);
  }
}

export function attachAppServerResponder(child, options, config, call = null) {
  let buffer = '';
  const context = {
    child,
    options,
    config,
    call,
    threadId: 'thread-1',
    turnCount: 0,
    write: (payload) => child.stdout.write(`${JSON.stringify(payload)}\n`)
  };
  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        handleMessage(context, parseJsonLine(line));
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });
}
