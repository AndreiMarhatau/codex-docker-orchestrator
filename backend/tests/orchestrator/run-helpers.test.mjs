import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  buildRunEnv,
  createOutputTracker,
  updateRunMeta
} = require('../../src/orchestrator/tasks/run-helpers');

describe('run helpers env', () => {
  it('builds run environment with deduped mounts', async () => {
    const root = await createTempDir();
    const codexHome = path.join(root, 'codex');
    const artifactsDir = path.join(root, 'artifacts');
    const sharedPath = path.join(root, 'shared');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(sharedPath, { recursive: true });

    const env = buildRunEnv({
      codexHome,
      artifactsDir,
      mountPaths: [sharedPath, '/tmp/missing'],
      mountPathsRo: [sharedPath],
      agentsAppendFile: null
    });

    expect(env.CODEX_MOUNT_PATHS).toContain(codexHome);
    expect(env.CODEX_MOUNT_PATHS).toContain(artifactsDir);
    expect(env.CODEX_MOUNT_PATHS).toContain(sharedPath);
    expect(env.CODEX_MOUNT_PATHS_RO || '').not.toContain(sharedPath);
  });

  it('clears empty mount variables', async () => {
    const root = await createTempDir();
    const codexHome = path.join(root, 'codex');
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_MOUNT_PATHS = '';
    process.env.CODEX_MOUNT_PATHS_RO = '';

    const env = buildRunEnv({
      codexHome,
      artifactsDir,
      mountPaths: [],
      mountPathsRo: [],
      agentsAppendFile: null
    });

    expect(env.CODEX_MOUNT_PATHS).toContain(codexHome);
    expect(env.CODEX_MOUNT_PATHS).toContain(artifactsDir);
    expect(env.CODEX_MOUNT_PATHS_RO).toBeUndefined();
    delete process.env.CODEX_MOUNT_PATHS;
    delete process.env.CODEX_MOUNT_PATHS_RO;
  });
});

describe('run helpers output', () => {
  it('tracks output and detects thread id', () => {
    const logStream = { write: vi.fn() };
    const stderrStream = { write: vi.fn() };
    const tracker = createOutputTracker({ logStream, stderrStream });

    tracker.onStdout(Buffer.from('{"type":"thread.started","thread_id":"thread-1"}\n'));
    tracker.onStdout(Buffer.from('not json\n'));
    tracker.onStderr(Buffer.from('warning\n'));

    const result = tracker.getResult();
    expect(result.threadId).toBe('thread-1');
    expect(result.stdout).toContain('thread.started');
    expect(result.stderr).toContain('warning');
  });
});

describe('run helpers meta updates', () => {
  it('updates run meta on success', async () => {
    const root = await createTempDir();
    const taskId = 'task-1';
    const runLabel = 'run-001';
    const taskDir = path.join(root, 'tasks', taskId);
    const artifactsDir = path.join(root, 'artifacts', taskId, runLabel);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.writeFile(path.join(artifactsDir, 'out.txt'), 'done');

    const meta = {
      taskId,
      runs: [{ runId: runLabel, logFile: `${runLabel}.jsonl` }]
    };
    await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));

    const result = {
      stdout: '',
      stderr: '',
      code: 0,
      threadId: 'thread-1'
    };
    const updated = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt: 'Hello',
      now: () => '2025-01-01T00:00:00.000Z',
      taskMetaPath: (id) => path.join(root, 'tasks', id, 'meta.json'),
      runArtifactsDir: () => artifactsDir
    });

    expect(updated.success).toBe(true);
    expect(updated.meta.status).toBe('completed');
    expect(updated.meta.error).toBe(null);
    expect(updated.meta.threadId).toBe('thread-1');
    expect(updated.meta.lastPrompt).toBe('Hello');
    expect(updated.meta.runs[0].status).toBe('completed');
    expect(updated.meta.runs[0].artifacts).toHaveLength(1);
  });

  it('marks stopped runs and skips run update when missing', async () => {
    const root = await createTempDir();
    const taskId = 'task-2';
    const runLabel = 'run-002';
    const taskDir = path.join(root, 'tasks', taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const meta = {
      taskId,
      threadId: 'thread-2',
      runs: [{ runId: 'other-run', logFile: 'other.jsonl' }]
    };
    await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));

    const result = {
      stdout: '',
      stderr: '',
      code: 1,
      stopped: true
    };
    const updated = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt: null,
      now: () => '2025-01-02T00:00:00.000Z',
      taskMetaPath: (id) => path.join(root, 'tasks', id, 'meta.json'),
      runArtifactsDir: () => path.join(root, 'artifacts', taskId, runLabel)
    });

    expect(updated.success).toBe(false);
    expect(updated.meta.status).toBe('stopped');
    expect(updated.meta.error).toBe('Stopped by user.');
    expect(updated.meta.runs[0].runId).toBe('other-run');
  });

  it('reports usage limit failures', async () => {
    const root = await createTempDir();
    const taskId = 'task-3';
    const runLabel = 'run-003';
    const taskDir = path.join(root, 'tasks', taskId);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({ taskId, runs: [] })
    );

    const result = {
      stdout: JSON.stringify({ type: 'error', message: "You've hit your usage limit" }),
      stderr: '',
      code: 1
    };
    const updated = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt: null,
      now: () => '2025-01-03T00:00:00.000Z',
      taskMetaPath: (id) => path.join(root, 'tasks', id, 'meta.json'),
      runArtifactsDir: () => path.join(root, 'artifacts', taskId, runLabel)
    });

    expect(updated.success).toBe(false);
    expect(updated.usageLimit).toBe(true);
    expect(updated.meta.status).toBe('failed');
    expect(updated.meta.error).toBe('Usage limit reached.');
  });
});
