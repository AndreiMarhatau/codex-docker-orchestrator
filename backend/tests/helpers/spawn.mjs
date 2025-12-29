import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

function createAppServerResponder({ rateLimits }) {
  return (child) => {
    let buffer = '';
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
          if (message?.method === 'initialize' && message.id !== undefined) {
            child.stdout.write(
              `${JSON.stringify({ id: message.id, result: { userAgent: 'codex-mock' } })}\n`
            );
          }
          if (message?.method === 'account/rateLimits/read' && message.id !== undefined) {
            child.stdout.write(`${JSON.stringify({ id: message.id, result: { rateLimits } })}\n`);
            child.stdout.end();
            child.emit('close', 0, null);
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
  }
} = {}) {
  const calls = [];
  const appServerResponder = createAppServerResponder({ rateLimits });
  const codexResponder = createCodexResponder({ threadId });

  const spawnMock = (command, args, options = {}) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {
      setImmediate(() => {
        child.emit('close', 143, 'SIGTERM');
      });
    };

    if (command === 'codex-docker' && args[0] === 'app-server') {
      appServerResponder(child);
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
