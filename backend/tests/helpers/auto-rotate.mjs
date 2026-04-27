/* eslint-disable complexity, max-lines */
import path from 'node:path';
import fsSync from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { isCodexAppServerArgs } from '../../src/orchestrator/app-server-args.js';

export const defaultRateLimits = {
  primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1730947200 },
  secondary: null,
  credits: null,
  planType: null
};

function createChild() {
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
  if (slashIndex === -1) {
    return null;
  }
  const subpath = source.slice(slashIndex + 1);
  const root = options?.env?.ORCH_DATA_DIR;
  if (!root) {
    return null;
  }
  return path.join(root, subpath);
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

function attachAppServerResponder(child, options, config, call = null) {
  const {
    rateLimitsByToken = {},
    refreshedAuthByToken = null,
    refreshedAuthRawByToken = null
  } = config || {};
  let buffer = '';
  let turnCount = 0;
  let threadId = 'thread-1';
  const write = (payload) => {
    child.stdout.write(`${JSON.stringify(payload)}\n`);
  };
  const emitCompletedTurn = ({ status = 'completed', text = 'OK', error = null }) => {
    turnCount += 1;
    const turnId = `turn-${turnCount}`;
    const item = { id: `item-${turnCount}`, type: 'agentMessage', text };
    setImmediate(() => {
      write({ method: 'turn/started', params: { turn: { id: turnId, status: 'inProgress', items: [] } } });
      if (status === 'completed') {
        write({ method: 'item/completed', params: { item } });
      }
      write({ method: 'turn/completed', params: { turn: { id: turnId, status, items: status === 'completed' ? [item] : [], error } } });
    });
    return turnId;
  };
  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        let message = null;
        try {
          message = JSON.parse(line);
        } catch (error) {
          message = null;
        }
        if (message && call) {
          call.messages.push(message);
        }
        if (message?.method === 'initialize' && message.id !== undefined) {
          write({ id: message.id, result: { userAgent: 'codex-mock' } });
        }
        if (message?.method === 'account/rateLimits/read' && message.id !== undefined) {
          const rateLimits = getRateLimitsForOptions(options, rateLimitsByToken);
          const codexHome = resolveMountedPath(options, '/root/.codex');
          if ((refreshedAuthByToken || refreshedAuthRawByToken) && codexHome) {
            try {
              const authPath = path.join(codexHome, 'auth.json');
              const auth = JSON.parse(fsSync.readFileSync(authPath, 'utf8'));
              const updatedAuthRaw = refreshedAuthRawByToken?.[auth.token];
              if (typeof updatedAuthRaw === 'string') {
                fsSync.writeFileSync(authPath, updatedAuthRaw);
              } else {
                const updatedAuth = refreshedAuthByToken?.[auth.token];
                if (updatedAuth) {
                  fsSync.writeFileSync(authPath, JSON.stringify(updatedAuth, null, 2));
                }
              }
            } catch (error) {
              // Ignore mock refresh persistence failures in tests.
            }
          }
          write({ id: message.id, result: { rateLimits } });
          child.stdout.end();
          child.emit('close', 0, null);
        }
        if (message?.method === 'thread/start' && message.id !== undefined) {
          const thread = { id: threadId, status: 'loaded', turns: [] };
          write({ id: message.id, result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' } });
          write({ method: 'thread/started', params: { thread } });
        }
        if (message?.method === 'thread/resume' && message.id !== undefined) {
          threadId = message.params?.threadId || threadId;
          const thread = { id: threadId, status: 'loaded', turns: [] };
          write({ id: message.id, result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' } });
          write({ method: 'thread/started', params: { thread } });
        }
        if (message?.method === 'turn/start' && message.id !== undefined) {
          const text = message.params?.input?.[0]?.text || '';
          const responseText = text.includes('branch name')
            ? JSON.stringify({ branchName: 'codex/mock-branch' })
            : text.includes('commit message')
              ? JSON.stringify({ message: 'Update mock task' })
              : 'OK';
          Promise.resolve(config.consumeUsageLimit?.()).then((usageLimited) => {
            const status = usageLimited ? 'failed' : 'completed';
            const error = status === 'failed' ? { message: "You've hit your usage limit." } : null;
            const turnId = emitCompletedTurn({ status, text: responseText, error });
            write({
              id: message.id,
              result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } }
            });
          });
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });
}

function emitUsageLimit(child) {
  child.stdout.write(
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
      '\n' +
      JSON.stringify({ type: 'error', message: "You've hit your usage limit." }) +
      '\n'
  );
  child.stdout.end();
  child.emit('close', 1, null);
}

function emitSuccess(child, isResume) {
  child.stdout.write(
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
      '\n' +
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' }
      }) +
      '\n'
  );
  child.stdout.end();
  child.emit('close', 0, null);
}

export function buildSpawnWithUsageLimit({
  spawnCalls,
  onBeforeLimit,
  rateLimitsByToken = {},
  refreshedAuthByToken = null,
  refreshedAuthRawByToken = null
}) {
  let runCount = 0;
  return (command, args, options = {}) => {
    const call = { command, args, options, messages: [] };
    if (options?.env?.ORCH_STRUCTURED_CODEX !== '1') {
      spawnCalls.push(call);
    }
    const child = createChild();
    if (command === 'codex-docker' && isCodexAppServerArgs(args)) {
      attachAppServerResponder(child, options, {
        rateLimitsByToken,
        refreshedAuthByToken,
        refreshedAuthRawByToken,
        consumeUsageLimit: async () => {
          if (options?.env?.ORCH_STRUCTURED_CODEX === '1') {
            return false;
          }
          if (runCount !== 0) {
            runCount += 1;
            return false;
          }
          if (onBeforeLimit) {
            await onBeforeLimit();
          }
          runCount += 1;
          return true;
        }
      }, call);
      return child;
    }
    const isResume = args.includes('resume');
    setImmediate(async () => {
      if (runCount === 0) {
        if (onBeforeLimit) {
          await onBeforeLimit();
        }
        emitUsageLimit(child);
      } else {
        emitSuccess(child, isResume);
      }
      runCount += 1;
    });
    return child;
  };
}
