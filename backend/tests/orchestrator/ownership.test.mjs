import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator ownership fixes', () => {
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
});
