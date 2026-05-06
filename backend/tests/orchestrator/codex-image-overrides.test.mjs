import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Codex image readiness overrides', () => {
  it('prepares the IMAGE_NAME override that a task will run', async () => {
    const orchHome = await createTempDir();
    const baseExec = createMockExec({ branches: ['main'] });
    const pulledImages = new Set();
    const exec = async (command, args, options) => {
      exec.calls.push({ command, args, options });
      if (command === 'docker' && args[0] === 'image' && args[1] === 'inspect') {
        const imageName = args[args.length - 1];
        return pulledImages.has(imageName)
          ? { stdout: `sha256:${imageName}|2026-05-06T00:00:00.000Z`, stderr: '', code: 0 }
          : { stdout: '', stderr: 'No such image', code: 1 };
      }
      if (command === 'docker' && args[0] === 'pull') {
        pulledImages.add(args[1]);
        return args[1] === 'global-private:latest'
          ? { stdout: '', stderr: 'denied', code: 1 }
          : { stdout: 'pulled', stderr: '', code: 0 };
      }
      return baseExec(command, args, options);
    };
    exec.calls = [];
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn,
      imageName: 'global-private:latest'
    });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main',
      envVars: { IMAGE_NAME: 'env-image:latest' }
    });

    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const pullImages = exec.calls
      .filter((call) => call.command === 'docker' && call.args[0] === 'pull')
      .map((call) => call.args[1]);
    expect(pullImages).toContain('env-image:latest');
    expect(pullImages).not.toContain('global-private:latest');
    expect(spawn.calls[0].options.env.IMAGE_NAME).toBe('env-image:latest');
  });
});
