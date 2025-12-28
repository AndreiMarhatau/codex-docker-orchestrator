import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator, parseThreadId } = require('../src/orchestrator');

async function waitForTaskStatus(orchestrator, taskId, status) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = await orchestrator.getTask(taskId);
    if (task.status === status) return task;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

describe('parseThreadId', () => {
  it('extracts thread_id from JSONL', () => {
    const jsonl = '{"type":"thread.started","thread_id":"abc"}\n{"type":"item.completed"}';
    expect(parseThreadId(jsonl)).toBe('abc');
  });

  it('ignores non-json lines and still finds thread_id', () => {
    const jsonl = 'banner line\n{"type":"thread.started","thread_id":"xyz"}\nnoise';
    expect(parseThreadId(jsonl)).toBe('xyz');
  });
});

describe('Orchestrator', () => {
  it('creates env and task, then resumes', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    expect(env.repoUrl).toBe('git@example.com:repo.git');

    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      model: 'gpt-5.2-codex',
      reasoningEffort: 'medium'
    });
    expect(task.status).toBe('running');
    expect(task.branchName).toContain('codex/');
    expect(task.model).toBe('gpt-5.2-codex');
    expect(task.reasoningEffort).toBe('medium');

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.threadId).toBe(spawn.threadId);
    expect(completed.initialPrompt).toBe('Do work');

    const resumed = await orchestrator.resumeTask(task.taskId, 'Continue', {
      model: 'gpt-5.2-codex',
      reasoningEffort: 'xhigh'
    });
    expect(resumed.status).toBe('running');
    const resumedCompleted = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(resumed.runs).toHaveLength(2);
    expect(resumedCompleted.lastPrompt).toBe('Continue');
    expect(resumedCompleted.model).toBe('gpt-5.2-codex');
    expect(resumedCompleted.reasoningEffort).toBe('medium');

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.runs).toHaveLength(2);
    expect(meta.runs[0].model).toBe('gpt-5.2-codex');
    expect(meta.runs[0].reasoningEffort).toBe('medium');
    expect(meta.runs[1].model).toBe('gpt-5.2-codex');
    expect(meta.runs[1].reasoningEffort).toBe('xhigh');
    expect(spawn.calls[0].args).toEqual(
      expect.arrayContaining(['--model', 'gpt-5.2-codex', '-c', 'model_reasoning_effort=medium'])
    );
    expect(spawn.calls[1].args).toEqual(
      expect.arrayContaining(['--model', 'gpt-5.2-codex', '-c', 'model_reasoning_effort=xhigh'])
    );
  });

  it('auto-rotates accounts on usage limit and resumes', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));

    const exec = createMockExec({ branches: ['main'] });
    const spawnCalls = [];
    let runCount = 0;
    const spawn = (command, args, options = {}) => {
      spawnCalls.push({ command, args, options });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => {
        setImmediate(() => {
          child.emit('close', 143, 'SIGTERM');
        });
      };
      const isResume = args.includes('resume');
      setImmediate(() => {
        if (runCount === 0) {
          child.stdout.write(
            JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
              '\n' +
              JSON.stringify({ type: 'error', message: "You've hit your usage limit." }) +
              '\n'
          );
          child.stdout.end();
          child.emit('close', 1, null);
        } else {
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
        runCount += 1;
      });
      return child;
    };

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    await orchestrator.addAccount({
      label: 'Secondary',
      authJson: JSON.stringify({ token: 'secondary' })
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);
    expect(spawnCalls.length).toBe(2);

    const activeAuth = JSON.parse(
      await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8')
    );
    expect(activeAuth).toEqual({ token: 'secondary' });
  });

  it('attempts to fix ownership before deleting a task', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    let fakeUid = null;
    let fakeGid = null;
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn,
      getUid: () => fakeUid,
      getGid: () => fakeGid
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const stat = await fs.stat(task.worktreePath);
    fakeUid = stat.uid === 0 ? 1000 : stat.uid;
    fakeGid = stat.gid === 0 ? 1000 : stat.gid;

    await orchestrator.deleteTask(task.taskId);

    const dockerChownCall = exec.calls.find(
      ({ command, args }) => command === 'docker' && args[0] === 'run' && args.some((arg) => arg.includes('chown -R'))
    );
    expect(dockerChownCall).toBeTruthy();
  });

  it('attempts to fix ownership before deleting an env', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    let fakeUid = null;
    let fakeGid = null;
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      getUid: () => fakeUid,
      getGid: () => fakeGid
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });

    const stat = await fs.stat(orchestrator.envDir(env.envId));
    fakeUid = stat.uid === 0 ? 1000 : stat.uid;
    fakeGid = stat.gid === 0 ? 1000 : stat.gid;

    await orchestrator.deleteEnv(env.envId);

    const dockerChownCall = exec.calls.find(
      ({ command, args }) => command === 'docker' && args[0] === 'run' && args.some((arg) => arg.includes('chown -R'))
    );
    expect(dockerChownCall).toBeTruthy();
  });

  it('mounts mirror path for runs', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall).toBeTruthy();
    const mountRw = runCall.options?.env?.CODEX_MOUNT_PATHS || '';
    expect(mountRw.split(':')).toContain(orchestrator.mirrorDir(env.envId));
    expect(runCall.options?.env?.CODEX_MOUNT_PATHS_RO).toBeUndefined();
  });

  it('mounts context repos read-only and injects instructions', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const primaryEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const contextEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context.git',
      defaultBranch: 'main'
    });

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnv.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall).toBeTruthy();
    const mountRo = runCall.options?.env?.CODEX_MOUNT_PATHS_RO || '';
    const contextPath = orchestrator.taskContextWorktree(task.taskId, contextEnv.repoUrl, contextEnv.envId);
    expect(mountRo.split(':')).toContain(contextPath);

    const agentsFile = runCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
    expect(agentsFile).toBeTruthy();
    const agentsContent = await fs.readFile(agentsFile, 'utf8');
    expect(agentsContent).toContain('Read-only reference repositories');
    expect(agentsContent).toContain(contextPath);
  });

  it('mounts docker socket when enabled and skips when disabled', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const socketDir = await createTempDir();
    const socketPath = path.join(socketDir, 'docker.sock');
    await fs.writeFile(socketPath, '');
    const originalDockerSock = process.env.DOCKER_SOCK;
    process.env.DOCKER_SOCK = socketPath;
    try {
      const orchestrator = new Orchestrator({
        orchHome,
        exec,
        spawn
      });

      const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
      const task = await orchestrator.createTask({
        envId: env.envId,
        ref: 'main',
        prompt: 'Do work',
        useHostDockerSocket: true
      });
      await waitForTaskStatus(orchestrator, task.taskId, 'completed');

      const createCall = spawn.calls.find((call) => call.command === 'codex-docker');
      const createMounts = createCall.options?.env?.CODEX_MOUNT_PATHS || '';
      expect(createMounts.split(':')).toContain(socketPath);
      const createAgentsFile = createCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
      expect(createAgentsFile).toBeTruthy();
      const createAgentsContent = await fs.readFile(createAgentsFile, 'utf8');
      expect(createAgentsContent).toContain('Host Docker Socket');

      await orchestrator.resumeTask(task.taskId, 'Continue', { useHostDockerSocket: false });
      await waitForTaskStatus(orchestrator, task.taskId, 'completed');

      const resumeCalls = spawn.calls.filter((call) => call.command === 'codex-docker');
      const resumeCall = resumeCalls[1];
      const resumeMounts = resumeCall.options?.env?.CODEX_MOUNT_PATHS || '';
      expect(resumeMounts.split(':')).not.toContain(socketPath);
      const resumeAgentsFile = resumeCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
      expect(resumeAgentsFile).toBeTruthy();
      const resumeAgentsContent = await fs.readFile(resumeAgentsFile, 'utf8');
      expect(resumeAgentsContent).not.toContain('Host Docker Socket');

      const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      expect(meta.useHostDockerSocket).toBe(false);
    } finally {
      if (originalDockerSock === undefined) {
        delete process.env.DOCKER_SOCK;
      } else {
        process.env.DOCKER_SOCK = originalDockerSock;
      }
    }
  });
});
