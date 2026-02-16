import fs from 'node:fs/promises';
import fsSync from 'node:fs';
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
function handleGitDirCommand({ normalizedArgs, branches, baseSha }) {
  if (normalizedArgs[0] === 'clone' && normalizedArgs[1] === '--bare') {
    const target = normalizedArgs[3];
    return fs.mkdir(target, { recursive: true }).then(() => ({ stdout: '', stderr: '', code: 0 }));
  }
  if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'config') {
    return Promise.resolve({ stdout: '', stderr: '', code: 0 });
  }
  if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'show-ref') {
    const ref = normalizedArgs[4];
    const branch = ref.replace('refs/remotes/origin/', '').replace('refs/heads/', '');
    if (branches.includes(branch)) {
      return Promise.resolve({ stdout: ref, stderr: '', code: 0 });
    }
    return Promise.resolve({ stdout: '', stderr: 'not found', code: 1 });
  }
  if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'fetch') {
    return Promise.resolve({ stdout: '', stderr: '', code: 0 });
  }
  if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'rev-parse') {
    return Promise.resolve({ stdout: `${baseSha}\n`, stderr: '', code: 0 });
  }
  if (normalizedArgs[0] === '--git-dir' && normalizedArgs[2] === 'worktree') {
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
  }
  return null;
}
function handleGitCCommand({ normalizedArgs, headSha, remoteHeadSha, statusPorcelain, diffHasChanges }) {
  if (normalizedArgs[0] !== '-C') {
    return null;
  }
  if (normalizedArgs[2] === 'checkout') {
    return Promise.resolve({ stdout: '', stderr: '', code: 0 });
  }
  if (normalizedArgs[2] === 'diff' && normalizedArgs[3] === '--quiet') {
    return Promise.resolve({ stdout: '', stderr: '', code: diffHasChanges ? 1 : 0 });
  }
  if (normalizedArgs[2] === 'diff') {
    const diff = `diff --git a/README.md b/README.md
index 0000000..1111111 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
-Old line
+New line
+Another line`;
    return Promise.resolve({ stdout: diff, stderr: '', code: 0 });
  }
  if (normalizedArgs[2] === 'status') {
    return Promise.resolve({ stdout: statusPorcelain, stderr: '', code: 0 });
  }
  if (normalizedArgs[2] === 'rev-parse' && normalizedArgs[3] === 'HEAD') {
    return Promise.resolve({ stdout: `${headSha}\n`, stderr: '', code: 0 });
  }
  if (normalizedArgs[2] === 'ls-remote' && normalizedArgs[3] === '--heads') {
    const branch = normalizedArgs[5] || 'unknown';
    if (!remoteHeadSha) {
      return Promise.resolve({ stdout: '', stderr: '', code: 0 });
    }
    return Promise.resolve({
      stdout: `${remoteHeadSha}\trefs/heads/${branch}\n`,
      stderr: '',
      code: 0
    });
  }
  if (normalizedArgs.includes('push')) {
    return Promise.resolve({ stdout: '', stderr: '', code: 0 });
  }
  return null;
}
function handleGitCommand({ args, branches, baseSha, headSha, remoteHeadSha, statusPorcelain, diffHasChanges }) {
  const normalizedArgs = normalizeGitArgs(args);
  const dirResult = handleGitDirCommand({ normalizedArgs, branches, baseSha });
  if (dirResult) {
    return dirResult;
  }
  return handleGitCCommand({ normalizedArgs, headSha, remoteHeadSha, statusPorcelain, diffHasChanges });
}
function handleDockerCommand({ args, dockerImageExists, dockerImageId, dockerCreatedAt }) {
  if (args[0] === 'volume' && args[1] === 'create') {
    return { stdout: `${args[2] || 'volume'}\n`, stderr: '', code: 0 };
  }
  if (args[0] === 'volume' && args[1] === 'rm') {
    return { stdout: '', stderr: '', code: 0 };
  }
  if (args[0] === 'container' && args[1] === 'inspect') {
    return { stdout: '', stderr: 'No such container', code: 1 };
  }
  if (args[0] === 'start' || args[0] === 'stop' || args[0] === 'rm') {
    return { stdout: '', stderr: '', code: 0 };
  }
  if (args[0] === '--host' && args[2] === 'info') {
    return { stdout: 'Server Version: mock\n', stderr: '', code: 0 };
  }
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
    const socketMount = args.find((arg) => typeof arg === 'string' && arg.endsWith(':/var/run/orch-task-docker'));
    if (socketMount) {
      const socketDir = socketMount.split(':/var/run/orch-task-docker')[0];
      try {
        fsSync.mkdirSync(socketDir, { recursive: true });
        fsSync.writeFileSync(`${socketDir}/docker.sock`, '');
      } catch (error) {
        void error;
      }
    }
    return { stdout: '', stderr: '', code: 0 };
  }
  return null;
}
export function createMockExec({
  branches = ['main'], dockerImageExists = true, dockerImageId = 'sha256:mock-image',
  dockerCreatedAt = '2025-12-18T12:34:56.000Z', baseSha = 'deadbeef1234567890',
  headSha = 'cafebabefeedface', remoteHeadSha = 'cafebabefeedface',
  statusPorcelain = '', diffHasChanges = true
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
