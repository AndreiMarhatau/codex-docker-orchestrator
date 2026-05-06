import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function waitForPullStart(getPullResolve) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const resolvePull = getPullResolve();
    if (resolvePull) {
      return resolvePull;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for image pull to start');
}

describe('Codex image readiness', () => {
  it('pulls the Codex image before spawning codex-docker when it is missing', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'], dockerImageExists: false });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn,
      imageName: 'ghcr.io/example/codex-docker@sha256:test'
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const pullIndex = exec.calls.findIndex((call) =>
      call.command === 'docker' &&
      call.args[0] === 'pull' &&
      call.args[1] === 'ghcr.io/example/codex-docker@sha256:test'
    );
    expect(pullIndex).toBeGreaterThanOrEqual(0);
    expect(spawn.calls[0].options.env.IMAGE_NAME).toBe('ghcr.io/example/codex-docker@sha256:test');
    expect(orchestrator.getCodexImageStatus()).toMatchObject({
      imageName: 'ghcr.io/example/codex-docker@sha256:test',
      ready: true,
      status: 'ready'
    });
  });

  it('publishes failed status when Docker cannot pull the image', async () => {
    const orchHome = await createTempDir();
    const exec = async (command, args, options) => {
      exec.calls.push({ command, args, options });
      if (command === 'docker' && args[0] === 'image') {
        return { stdout: '', stderr: 'No such image', code: 1 };
      }
      if (command === 'docker' && args[0] === 'pull') {
        return { stdout: '', stderr: 'denied', code: 1 };
      }
      return { stdout: '', stderr: 'unknown command', code: 1 };
    };
    exec.calls = [];
    const orchestrator = new Orchestrator({
      orchHome,
      exec,
      spawn: createMockSpawn(),
      imageName: 'ghcr.io/example/private:latest'
    });

    await expect(orchestrator.ensureCodexImageReady()).rejects.toThrow('denied');
    expect(orchestrator.getCodexImageStatus()).toMatchObject({
      imageName: 'ghcr.io/example/private:latest',
      ready: false,
      status: 'failed',
      error: 'denied'
    });
  });

  it('keeps a shared pull running when one waiter is cancelled', async () => {
    const orchHome = await createTempDir();
    let imagePulled = false;
    let resolvePull = null;
    const exec = async (command, args, options = {}) => {
      exec.calls.push({ command, args, options });
      if (command === 'docker' && args[0] === 'image') {
        return imagePulled
          ? { stdout: 'sha256:mock|2026-05-06T00:00:00.000Z', stderr: '', code: 0 }
          : { stdout: '', stderr: 'No such image', code: 1 };
      }
      if (command === 'docker' && args[0] === 'pull') {
        return new Promise((resolve, reject) => {
          const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          options.signal?.addEventListener('abort', abort, { once: true });
          resolvePull = () => {
            options.signal?.removeEventListener('abort', abort);
            imagePulled = true;
            resolve({ stdout: 'pulled', stderr: '', code: 0 });
          };
        });
      }
      return { stdout: '', stderr: 'unknown command', code: 1 };
    };
    exec.calls = [];
    const orchestrator = new Orchestrator({
      orchHome,
      exec,
      spawn: createMockSpawn(),
      imageName: 'ghcr.io/example/codex-docker:latest'
    });
    const controller = new AbortController();
    const first = orchestrator.ensureCodexImageReady({ signal: controller.signal });
    const second = orchestrator.ensureCodexImageReady();

    const finishPull = await waitForPullStart(() => resolvePull);
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    finishPull();

    await expect(second).resolves.toMatchObject({ ready: true, status: 'ready' });
  });

});
