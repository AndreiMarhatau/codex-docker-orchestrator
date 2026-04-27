import fs from 'node:fs/promises';
import { handleDockerCommand } from './docker-exec.mjs';

function normalizeGitArgs(args) {
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
}

function ok(stdout = '') {
  return Promise.resolve({ stdout, stderr: '', code: 0 });
}

function handleGitDirCommand({ normalizedArgs, branches, baseSha }) {
  if (normalizedArgs[0] === 'clone' && normalizedArgs[1] === '--bare') {
    const target = normalizedArgs[3];
    return fs.mkdir(target, { recursive: true }).then(() => ({ stdout: '', stderr: '', code: 0 }));
  }
  if (normalizedArgs[0] !== '--git-dir') {
    return null;
  }
  if (normalizedArgs[2] === 'config' || normalizedArgs[2] === 'fetch') {
    return ok();
  }
  if (normalizedArgs[2] === 'rev-parse') {
    return ok(`${baseSha}\n`);
  }
  if (normalizedArgs[2] === 'show-ref') {
    const ref = normalizedArgs[4];
    const branch = ref.replace('refs/remotes/origin/', '').replace('refs/heads/', '');
    return branches.includes(branch)
      ? ok(ref)
      : Promise.resolve({ stdout: '', stderr: 'not found', code: 1 });
  }
  if (normalizedArgs[2] === 'worktree') {
    return handleGitWorktreeCommand(normalizedArgs);
  }
  return null;
}

function handleGitWorktreeCommand(normalizedArgs) {
  if (normalizedArgs[3] === 'add') {
    const detachIndex = normalizedArgs.indexOf('--detach');
    const worktreePath = detachIndex !== -1 ? normalizedArgs[detachIndex + 1] : normalizedArgs[4];
    return fs.mkdir(worktreePath, { recursive: true }).then(() => ({ stdout: '', stderr: '', code: 0 }));
  }
  if (normalizedArgs[3] === 'remove') {
    const worktreePath = normalizedArgs[5];
    return fs.rm(worktreePath, { recursive: true, force: true }).then(() => ({
      stdout: '',
      stderr: '',
      code: 0
    }));
  }
  return null;
}

function handleSimpleGitCCommand(normalizedArgs) {
  const simpleCommands = new Set(['checkout', 'add', 'config', 'commit', 'ls-files']);
  if (normalizedArgs[2] === 'check-ref-format') {
    return ok(normalizedArgs[4] || '');
  }
  if (normalizedArgs[2] === 'show-ref') {
    return Promise.resolve({ stdout: '', stderr: 'not found', code: 1 });
  }
  if (simpleCommands.has(normalizedArgs[2])) {
    return normalizedArgs[2] === 'commit' ? ok('[mock] commit\n') : ok();
  }
  return null;
}

function handleGitDiffCommand(normalizedArgs, diffHasChanges) {
  if (normalizedArgs[2] !== 'diff') {
    return null;
  }
  if (normalizedArgs.includes('--quiet')) {
    return Promise.resolve({ stdout: '', stderr: '', code: diffHasChanges ? 1 : 0 });
  }
  const diff = `diff --git a/README.md b/README.md
index 0000000..1111111 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
-Old line
+New line
+Another line`;
  return ok(diff);
}

function handleGitRemoteCommand({ normalizedArgs, remoteHeadSha }) {
  if (normalizedArgs[2] === 'rev-parse' && normalizedArgs[3] === 'HEAD') {
    return null;
  }
  if (normalizedArgs[2] !== 'ls-remote' || normalizedArgs[3] !== '--heads') {
    return null;
  }
  const branch = normalizedArgs[5] || 'unknown';
  if (!remoteHeadSha || String(branch).startsWith('codex/mock-branch')) {
    return ok();
  }
  return ok(`${remoteHeadSha}\trefs/heads/${branch}\n`);
}

function handleGitCCommand(options) {
  const { normalizedArgs, headSha, statusPorcelain, diffHasChanges } = options;
  if (normalizedArgs[0] !== '-C') {
    return null;
  }
  return (
    handleSimpleGitCCommand(normalizedArgs) ||
    handleGitDiffCommand(normalizedArgs, diffHasChanges) ||
    (normalizedArgs[2] === 'status' ? ok(statusPorcelain) : null) ||
    (normalizedArgs[2] === 'rev-parse' && normalizedArgs[3] === 'HEAD' ? ok(`${headSha}\n`) : null) ||
    handleGitRemoteCommand(options) ||
    (normalizedArgs.includes('push') ? ok() : null)
  );
}

function handleGitCommand(options) {
  const normalizedArgs = normalizeGitArgs(options.args);
  const dirResult = handleGitDirCommand({ ...options, normalizedArgs });
  if (dirResult) {
    return dirResult;
  }
  return handleGitCCommand({ ...options, normalizedArgs });
}

function codexDockerResult(args, threadId) {
  const resumeIndex = args.indexOf('resume');
  const isResume = resumeIndex !== -1 && resumeIndex <= args.length - 3;
  const stdout =
    'banner line\n' +
    JSON.stringify({ type: 'thread.started', thread_id: threadId }) +
    '\n' +
    JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' }
    });
  return { stdout, stderr: '', code: 0 };
}

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
  const exec = async (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === 'git') {
      const result = await handleGitCommand({
        args,
        branches,
        baseSha,
        headSha,
        remoteHeadSha,
        statusPorcelain,
        diffHasChanges
      });
      if (result) {
        return result;
      }
    }
    if (command === 'codex-docker') {
      return codexDockerResult(args, threadId);
    }
    if (command === 'docker') {
      const result = handleDockerCommand({
        args,
        dockerImageExists,
        dockerImageId,
        dockerCreatedAt
      });
      if (result) {
        return result;
      }
    }
    return { stdout: '', stderr: 'unknown command', code: 1 };
  };
  exec.calls = calls;
  exec.threadId = threadId;
  return exec;
}
