import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import {
  buildStaleRunningMeta,
  createOrchestrator,
  writeTaskMeta
} from './task-runtime-state-helpers.mjs';

async function waitForCodexDockerSpawn(spawn) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (spawn.calls.some((call) => call.command === 'codex-docker')) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

describe('Orchestrator task runtime state mutation claims', () => {
  it('reconciles stale running state before direct resume despite the resume mutex claim', async () => {
    const orchHome = await createTempDir();
    const spawn = createMockSpawn();
    const orchestrator = createOrchestrator(orchHome, {
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const taskId = 'task-direct-resume';
    const worktreePath = path.join(orchHome, 'tasks', taskId, 'repo');
    await fs.mkdir(worktreePath, { recursive: true });
    await writeTaskMeta(orchHome, buildStaleRunningMeta(taskId, {
      envId: env.envId,
      repoUrl: env.repoUrl,
      branchName: `codex/${taskId}`,
      worktreePath,
      threadId: 'thread-1'
    }));

    const resumed = await orchestrator.resumeTask(taskId, 'Continue');

    expect(resumed.status).toBe('running');
    expect(resumed.runs).toHaveLength(2);
    expect(resumed.runs[0].status).toBe('stopped');
    expect(await waitForCodexDockerSpawn(spawn)).toBe(true);
  });
});
