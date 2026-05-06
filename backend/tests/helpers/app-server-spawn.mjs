import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createMockSpawn } from './spawn.mjs';
import { isCodexAppServerArgs } from '../../src/shared/codex/app-server-args.js';

function createChild(pid) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.pid = pid;
  child.kill = () => {
    setImmediate(() => {
      child.emit('close', 143, 'SIGTERM');
    });
  };
  return child;
}

function write(child, payload) {
  child.stdout.write(`${JSON.stringify(payload)}\n`);
}

function resolveWaiters(waiters, value) {
  while (waiters.length > 0) {
    waiters.shift()(value);
  }
}

function createManualServer({ threadId, pid, call }) {
  const child = createChild(pid);
  let buffer = '';
  let activeThreadId = threadId;
  let turnCount = 0;
  let latestTurnId = null;
  let latestTurnStarted = false;
  let goalSetSettled = false;
  const turnWaiters = [];
  const goalSetWaiters = [];
  const server = {
    child,
    call,
    completeTurn({ status = 'completed', text = 'OK', error = null } = {}) {
      const turnId = latestTurnId || `turn-${turnCount + 1}`;
      const item = { id: `item-${turnCount || 1}`, type: 'agentMessage', text };
      if (!latestTurnStarted) {
        write(child, { method: 'turn/started', params: { turn: { id: turnId, status: 'inProgress', items: [] } } });
      }
      if (status === 'completed') {
        write(child, { method: 'item/completed', params: { item } });
      }
      write(child, {
        method: 'turn/completed',
        params: { turn: { id: turnId, status, items: status === 'completed' ? [item] : [], error } }
      });
      latestTurnStarted = false;
    },
    startContinuationTurn({ turnId = `turn-${turnCount + 1}` } = {}) {
      turnCount += 1;
      latestTurnId = turnId;
      latestTurnStarted = true;
      write(child, { method: 'turn/started', params: { turn: { id: latestTurnId, status: 'inProgress', items: [] } } });
    },
    updateGoal({ status = 'active', objective = 'Mock goal' } = {}) {
      const goal = {
        threadId: activeThreadId,
        objective,
        status,
        tokenBudget: null,
        tokensUsed: 0,
        timeUsedSeconds: 0,
        createdAt: 1,
        updatedAt: 1
      };
      write(child, { method: 'thread/goal/updated', params: { threadId: activeThreadId, turnId: latestTurnId, goal } });
      return goal;
    },
    close(code = 0, signal = null) {
      child.stdout.end();
      child.emit('close', code, signal);
    },
    waitForTurnStart() {
      if (latestTurnId) {
        return Promise.resolve(server);
      }
      return new Promise((resolve) => turnWaiters.push(resolve));
    },
    waitForGoalSet() {
      if (goalSetSettled) {
        return Promise.resolve(server);
      }
      return new Promise((resolve) => goalSetWaiters.push(resolve));
    }
  };

  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        const message = JSON.parse(line);
        call.messages.push(message);
        if (message.method === 'initialize' && message.id !== undefined) {
          write(child, { id: message.id, result: { userAgent: 'codex-mock' } });
        }
        if (message.method === 'thread/start' && message.id !== undefined) {
          const thread = { id: activeThreadId, status: 'loaded', turns: [] };
          write(child, { id: message.id, result: { thread, model: 'mock', modelProvider: 'mock' } });
          write(child, { method: 'thread/started', params: { thread } });
        }
        if (message.method === 'thread/resume' && message.id !== undefined) {
          activeThreadId = message.params?.threadId || activeThreadId;
          const thread = { id: activeThreadId, status: 'loaded', turns: [] };
          write(child, { id: message.id, result: { thread, model: 'mock', modelProvider: 'mock' } });
          write(child, { method: 'thread/started', params: { thread } });
        }
        if (message.method === 'turn/start' && message.id !== undefined) {
          turnCount += 1;
          latestTurnId = `turn-${turnCount}`;
          latestTurnStarted = false;
          write(child, { id: message.id, result: { turn: { id: latestTurnId, status: 'inProgress', items: [], error: null } } });
          resolveWaiters(turnWaiters, server);
        }
        if (message.method === 'thread/goal/set' && message.id !== undefined) {
          const goal = {
            threadId: message.params?.threadId || activeThreadId,
            objective: message.params?.objective || 'Mock goal',
            status: message.params?.status || 'active',
            tokenBudget: null,
            tokensUsed: 0,
            timeUsedSeconds: 0,
            createdAt: 1,
            updatedAt: 1
          };
          write(child, { id: message.id, result: { goal } });
          write(child, { method: 'thread/goal/updated', params: { threadId: goal.threadId, turnId: null, goal } });
          goalSetSettled = true;
          resolveWaiters(goalSetWaiters, server);
        }
        if (message.method === 'thread/goal/clear' && message.id !== undefined) {
          write(child, { id: message.id, result: {} });
          write(child, { method: 'thread/goal/cleared', params: { threadId: message.params?.threadId || activeThreadId } });
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });
  return server;
}

export function createManualAppServerSpawn({
  threadId = '019b341f-04d9-73b3-8263-2c05ca63d690',
  pid = 43210
} = {}) {
  const baseSpawn = createMockSpawn({ threadId });
  const servers = [];
  const spawn = (command, args, options = {}) => {
    const isMainAppServer =
      command === 'codex-docker' &&
      isCodexAppServerArgs(args) &&
      options?.env?.ORCH_STRUCTURED_CODEX !== '1';
    if (!isMainAppServer) {
      return baseSpawn(command, args, options);
    }
    const call = { command, args, options, messages: [] };
    spawn.calls.push(call);
    const server = createManualServer({ threadId, pid, call });
    servers.push(server);
    return server.child;
  };
  spawn.calls = baseSpawn.calls;
  spawn.threadId = threadId;
  spawn.servers = servers;
  spawn.latestServer = () => servers[servers.length - 1] || null;
  spawn.finishRun = (options) => spawn.latestServer()?.completeTurn(options);
  return spawn;
}

export function countAppServerTaskRuns(calls) {
  return calls.filter(
    (call) =>
      call.command === 'codex-docker' &&
      isCodexAppServerArgs(call.args) &&
      call.options?.env?.ORCH_STRUCTURED_CODEX !== '1' &&
      (!Array.isArray(call.messages) ||
        call.messages.some((message) =>
          ['turn/start', 'review/start', 'thread/goal/set'].includes(message.method)
        ))
  ).length;
}
