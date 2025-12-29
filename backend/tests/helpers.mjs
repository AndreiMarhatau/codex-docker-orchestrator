import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

export function createMockExec({
  branches = ['main'],
  dockerImageExists = true,
  dockerImageId = 'sha256:mock-image',
  dockerCreatedAt = '2025-12-18T12:34:56.000Z',
  baseSha = 'deadbeef1234567890',
  headSha = 'cafebabefeedface',
  remoteHeadSha = 'cafebabefeedface',
  statusPorcelain = '',
  diffHasChanges = true
} = {}) {
  const calls = [];
  const threadId = '019b341f-04d9-73b3-8263-2c05ca63d690';

  const normalizeGitArgs = (args) => {
    const normalized = [];
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      const next = args[i + 1];
      if (arg === '-c' && typeof next === 'string' && next.startsWith('credential.helper=')) {
        i += 1;
        continue;
      }
      normalized.push(arg);
    }
    return normalized;
  };

  const exec = async (command, args, options = {}) => {
    calls.push({ command, args, options });

    if (command === 'git') {
      const normalizedArgs = normalizeGitArgs(args);
      if (normalizedArgs[0] === 'clone' && normalizedArgs[1] === '--bare') {
        const target = normalizedArgs[3];
        await fs.mkdir(target, { recursive: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (
        normalizedArgs[0] === '--git-dir' &&
        normalizedArgs[2] === 'config' &&
        normalizedArgs[3] === 'remote.origin.fetch'
      ) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'show-ref') {
        const ref = normalizedArgs[4];
        const branch = ref.replace('refs/remotes/origin/', '').replace('refs/heads/', '');
        if (branches.includes(branch)) {
          return { stdout: ref, stderr: '', code: 0 };
        }
        return { stdout: '', stderr: 'not found', code: 1 };
      }
      if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'fetch') {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'rev-parse') {
        return { stdout: `${baseSha}\n`, stderr: '', code: 0 };
      }
      if (
        normalizedArgs[0] === '--git-dir' &&
        normalizedArgs[2] === 'worktree' &&
        normalizedArgs[3] === 'add'
      ) {
        const detachIndex = normalizedArgs.indexOf('--detach');
        const worktreePath = detachIndex !== -1 ? normalizedArgs[detachIndex + 1] : normalizedArgs[4];
        await fs.mkdir(worktreePath, { recursive: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs[2] === 'checkout') {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs[2] === 'diff' && normalizedArgs[3] === '--quiet') {
        return { stdout: '', stderr: '', code: diffHasChanges ? 1 : 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs[2] === 'diff') {
        const diff = [
          'diff --git a/README.md b/README.md',
          'index 0000000..1111111 100644',
          '--- a/README.md',
          '+++ b/README.md',
          '@@ -1 +1,2 @@',
          '-Old line',
          '+New line',
          '+Another line'
        ].join('\n');
        return { stdout: diff, stderr: '', code: 0 };
      }
      if (
        normalizedArgs[0] === '-C' &&
        normalizedArgs[2] === 'status' &&
        normalizedArgs[3] === '--porcelain'
      ) {
        return { stdout: statusPorcelain, stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs[2] === 'rev-parse' && normalizedArgs[3] === 'HEAD') {
        return { stdout: `${headSha}\n`, stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs[2] === 'ls-remote' && normalizedArgs[3] === '--heads') {
        const branch = normalizedArgs[5] || 'unknown';
        if (!remoteHeadSha) {
          return { stdout: '', stderr: '', code: 0 };
        }
        return { stdout: `${remoteHeadSha}\trefs/heads/${branch}\n`, stderr: '', code: 0 };
      }
      if (
        normalizedArgs[0] === '--git-dir' &&
        normalizedArgs[2] === 'worktree' &&
        normalizedArgs[3] === 'remove'
      ) {
        const worktreePath = normalizedArgs[5];
        await fs.rm(worktreePath, { recursive: true, force: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (normalizedArgs[0] === '-C' && normalizedArgs.includes('push')) {
        return { stdout: '', stderr: '', code: 0 };
      }
    }

    if (command === 'codex-docker') {
      const resumeIndex = args.indexOf('resume');
      const isResume = resumeIndex !== -1 && resumeIndex <= args.length - 3;
      const stdout = 'banner line\n' + JSON.stringify({ type: 'thread.started', thread_id: threadId }) + '\n' +
        JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' } });
      return { stdout, stderr: '', code: 0 };
    }

    if (command === 'docker') {
      if (args[0] === 'image' && args[1] === 'inspect') {
        if (!dockerImageExists) {
          return { stdout: '', stderr: 'No such image', code: 1 };
        }
        return { stdout: `${dockerImageId}|${dockerCreatedAt}`, stderr: '', code: 0 };
      }
      if (args[0] === 'pull') {
        return { stdout: 'pulled', stderr: '', code: 0 };
      }
      if (args[0] === 'run') {
        return { stdout: '', stderr: '', code: 0 };
      }
    }

    return { stdout: '', stderr: 'unknown command', code: 1 };
  };

  exec.calls = calls;
  exec.threadId = threadId;

  return exec;
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
    if (command === 'codex' && args[0] === 'app-server') {
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
              child.stdout.write(
                `${JSON.stringify({ id: message.id, result: { rateLimits } })}\n`
              );
              child.stdout.end();
              child.emit('close', 0, null);
            }
          }
          newlineIndex = buffer.indexOf('\n');
        }
      });
      return child;
    }

    const resumeIndex = args.indexOf('resume');
    const isResume = resumeIndex !== -1 && resumeIndex <= args.length - 3;
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
    return child;
  };
  spawnMock.calls = calls;
  spawnMock.threadId = threadId;
  return spawnMock;
}

export async function createTempDir() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-orch-'));
  return base;
}
