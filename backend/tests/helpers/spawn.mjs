/* eslint-disable complexity */
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { isCodexAppServerArgs } from '../../src/orchestrator/app-server-args.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAppServerResponder({
  rateLimits,
  defaultAgentMessageText,
  onBeforeTurnComplete,
  turnCompletionDelayMs
}) {
  return (child, call = null, options = {}) => {
    let buffer = '';
    let lastThreadId = '019b341f-04d9-73b3-8263-2c05ca63d690';
    let turnCount = 0;
    const write = (payload) => {
      child.stdout.write(`${JSON.stringify(payload)}\n`);
    };
    const emitTurn = ({ turnId, item, message }) => {
      setImmediate(async () => {
        write({ method: 'turn/started', params: { turn: { id: turnId, status: 'inProgress', items: [] } } });
        if (onBeforeTurnComplete) {
          await onBeforeTurnComplete({ child, call, options, message, turnId });
        }
        if (turnCompletionDelayMs > 0) {
          await delay(turnCompletionDelayMs);
        }
        write({ method: 'item/completed', params: { item } });
        write({ method: 'turn/completed', params: { turn: { id: turnId, status: 'completed', items: [item] } } });
      });
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
            write({ id: message.id, result: { rateLimits } });
            child.stdout.end();
            child.emit('close', 0, null);
          }
          if (message?.method === 'thread/start' && message.id !== undefined) {
            lastThreadId = message.params?.ephemeral ? `thread-ephemeral-${Date.now()}` : lastThreadId;
            const thread = { id: lastThreadId, status: 'loaded', turns: [] };
            write({ id: message.id, result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' } });
            write({ method: 'thread/started', params: { thread } });
          }
          if (message?.method === 'thread/resume' && message.id !== undefined) {
            lastThreadId = message.params?.threadId || lastThreadId;
            const thread = { id: lastThreadId, status: 'loaded', turns: [] };
            write({ id: message.id, result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' } });
            write({ method: 'thread/started', params: { thread } });
          }
          if (message?.method === 'turn/start' && message.id !== undefined) {
            turnCount += 1;
            const turnId = `turn-${turnCount}`;
            const text = message.params?.input?.[0]?.text || '';
            let responseText = text.includes('commit message')
              ? JSON.stringify({ message: 'Update mock task' })
              : defaultAgentMessageText;
            if (message.params?.outputSchema && text.includes('branch name')) {
              responseText = JSON.stringify({ branchName: 'codex/mock-branch' });
            }
            const item = { id: `item-${turnCount}`, type: 'agentMessage', text: responseText };
            write({ id: message.id, result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } } });
            emitTurn({ turnId, item, message });
          }
          if (message?.method === 'review/start' && message.id !== undefined) {
            turnCount += 1;
            const turnId = `turn-${turnCount}`;
            const item = { id: `review-${turnCount}`, type: 'exitedReviewMode', review: 'No findings.' };
            write({
              id: message.id,
              result: {
                turn: { id: turnId, status: 'inProgress', items: [], error: null },
                reviewThreadId: `review-${lastThreadId}`
              }
            });
            emitTurn({ turnId, item, message });
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });
  };
}

function createCodexResponder({ threadId }) {
  return (child, isResume) => {
    setImmediate(() => {
      child.stdout.write(
        'banner line\n' +
          JSON.stringify({ type: 'thread.started', thread_id: threadId }) +
          '\n' +
          JSON.stringify({
            type: 'item.completed',
            item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' }
          }) +
          '\n'
      );
      child.stdout.end();
      child.emit('close', 0, null);
    });
  };
}

export function createMockSpawn({
  threadId = '019b341f-04d9-73b3-8263-2c05ca63d690',
  rateLimits = {
    primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1730947200 },
    secondary: null,
    credits: null,
    planType: null
  },
  defaultAgentMessageText = 'OK',
  onBeforeTurnComplete = null,
  turnCompletionDelayMs = 0,
  recordStructuredCodex = false,
  ignoreSigterm = false,
  childPid = null
} = {}) {
  const calls = [];
  const appServerResponder = createAppServerResponder({
    rateLimits,
    defaultAgentMessageText,
    onBeforeTurnComplete,
    turnCompletionDelayMs
  });
  const codexResponder = createCodexResponder({ threadId });

  const spawnMock = (command, args, options = {}) => {
    const shouldRecord =
      recordStructuredCodex || options?.env?.ORCH_STRUCTURED_CODEX !== '1';
    const call = { command, args, options, messages: [] };
    if (shouldRecord) {
      calls.push(call);
    }
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    if (Number.isInteger(childPid)) {
      child.pid = childPid;
    }
    child.killedSignals = [];
    child.closed = false;
    child.on('close', () => {
      child.closed = true;
    });
    child.kill = (signal = 'SIGTERM') => {
      child.killedSignals.push(signal);
      child.killedSignal = signal;
      if (child.closed || (ignoreSigterm && signal === 'SIGTERM')) {
        return true;
      }
      setImmediate(() => {
        if (!child.closed) {
          child.emit('close', signal === 'SIGKILL' ? 137 : 143, signal);
        }
      });
      return true;
    };
    call.child = child;

    if (command === 'codex-docker' && isCodexAppServerArgs(args)) {
      appServerResponder(child, call, options);
      return child;
    }

    const resumeIndex = args.indexOf('resume');
    const isResume = resumeIndex !== -1 && resumeIndex <= args.length - 3;
    codexResponder(child, isResume);
    return child;
  };

  spawnMock.calls = calls;
  spawnMock.threadId = threadId;
  return spawnMock;
}
