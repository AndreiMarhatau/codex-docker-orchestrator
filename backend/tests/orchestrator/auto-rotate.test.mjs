import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator auto-rotate', () => {
  it('does not auto-rotate when usage limit appears in agent output of a successful run', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));

    const exec = createMockExec({ branches: ['main'] });
    const spawnCalls = [];
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
      setImmediate(() => {
        child.stdout.write(
          JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
            '\n' +
            JSON.stringify({
              type: 'item.completed',
              item: {
                id: 'item_1',
                type: 'agent_message',
                text: 'Approaching usage limit, switching soon.'
              }
            }) +
            '\n'
        );
        child.stdout.end();
        child.emit('close', 0, null);
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
    expect(completed.autoRotateCount || 0).toBe(0);
    expect(spawnCalls.length).toBe(1);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'primary' });
  });

  it('skips rotation when usage limit hits an outdated account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));

    const exec = createMockExec({ branches: ['main'] });
    const spawnCalls = [];
    let orchestrator = null;
    const spawn = buildSpawnWithUsageLimit({
      spawnCalls,
      onBeforeLimit: async () => {
        await orchestrator.accountStore.rotateActiveAccount();
      }
    });

    orchestrator = new Orchestrator({
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

    const failed = await waitForTaskStatus(orchestrator, task.taskId, 'failed');
    expect(failed.autoRotateCount || 0).toBe(0);
    expect(spawnCalls.length).toBe(1);
  });
});
