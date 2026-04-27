import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { isCodexAppServerArgs } from '../../src/shared/codex/app-server-args.js';
import { createAppServerResponder } from './app-server-responder.mjs';

function createMockChild({ ignoreSigterm, childPid }) {
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
  return child;
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
  reviewTexts = null,
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
    reviewTexts,
    onBeforeTurnComplete,
    turnCompletionDelayMs
  });
  const codexResponder = createCodexResponder({ threadId });
  const spawnMock = (command, args, options = {}) => {
    const shouldRecord = recordStructuredCodex || options?.env?.ORCH_STRUCTURED_CODEX !== '1';
    const call = { command, args, options, messages: [] };
    if (shouldRecord) {
      calls.push(call);
    }
    const child = createMockChild({ ignoreSigterm, childPid });
    call.child = child;
    if (command === 'codex-docker' && isCodexAppServerArgs(args)) {
      appServerResponder(child, call, options);
      return child;
    }
    const resumeIndex = args.indexOf('resume');
    codexResponder(child, resumeIndex !== -1 && resumeIndex <= args.length - 3);
    return child;
  };
  spawnMock.calls = calls;
  spawnMock.threadId = threadId;
  return spawnMock;
}
