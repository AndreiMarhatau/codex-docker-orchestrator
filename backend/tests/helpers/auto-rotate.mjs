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

function getRateLimitsForOptions(options, rateLimitsByToken) {
  try {
    const authPath = path.join(options.env.CODEX_HOME, 'auth.json');
    const auth = JSON.parse(fsSync.readFileSync(authPath, 'utf8'));
    return rateLimitsByToken[auth.token] || defaultRateLimits;
  } catch (error) {
    return defaultRateLimits;
  }
}

function attachAppServerResponder(child, options, rateLimitsByToken, refreshedAuthByToken) {
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
          child.stdout.write(`${JSON.stringify({ id: message.id, result: { userAgent: 'codex-mock' } })}\n`);
        }
        if (message?.method === 'account/rateLimits/read' && message.id !== undefined) {
          const rateLimits = getRateLimitsForOptions(options, rateLimitsByToken);
          if (refreshedAuthByToken && options?.env?.CODEX_HOME) {
            try {
              const authPath = path.join(options.env.CODEX_HOME, 'auth.json');
              const auth = JSON.parse(fsSync.readFileSync(authPath, 'utf8'));
              const updatedAuth = refreshedAuthByToken[auth.token];
              if (updatedAuth) {
                fsSync.writeFileSync(authPath, JSON.stringify(updatedAuth, null, 2));
              }
            } catch (error) {
              // Ignore mock refresh persistence failures in tests.
            }
          }
          child.stdout.write(`${JSON.stringify({ id: message.id, result: { rateLimits } })}\n`);
          child.stdout.end();
          child.emit('close', 0, null);
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
  refreshedAuthByToken = null
}) {
  let runCount = 0;
  return (command, args, options = {}) => {
    spawnCalls.push({ command, args, options });
    const child = createChild();
    if (command === 'codex-docker' && args[0] === 'app-server') {
      attachAppServerResponder(child, options, rateLimitsByToken, refreshedAuthByToken);
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
