import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

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

function createExec({ branches = ['main'] } = {}) {
  return async (command, args) => {
    if (command !== 'git') {
      return { stdout: '', stderr: '', code: 1 };
    }
    const normalizedArgs = normalizeGitArgs(args);
    if (normalizedArgs[0] === 'clone') {
      await fs.mkdir(normalizedArgs[3], { recursive: true });
      return { stdout: '', stderr: '', code: 0 };
    }
    if (normalizedArgs[2] === 'config') {
      return { stdout: '', stderr: '', code: 0 };
    }
    if (normalizedArgs[2] === 'show-ref') {
      const ref = normalizedArgs[4];
      const branch = ref.replace('refs/remotes/origin/', '').replace('refs/heads/', '');
      return { stdout: '', stderr: 'not found', code: branches.includes(branch) ? 0 : 1 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
}

describe('orchestrator envs', () => {
  it('throws when default branch is missing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({ orchHome, exec: createExec({ branches: [] }) });
    await expect(
      orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
    ).rejects.toThrow(/Default branch/);
  });

  it('skips invalid env folders when listing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({ orchHome, exec: createExec() });
    const envsDir = path.join(orchHome, 'envs');
    await fs.mkdir(envsDir, { recursive: true });

    const badEnv = path.join(envsDir, 'bad');
    await fs.mkdir(badEnv, { recursive: true });
    await fs.writeFile(path.join(badEnv, 'repo.url'), 'git@example.com:bad.git');

    const goodEnv = path.join(envsDir, 'good');
    await fs.mkdir(goodEnv, { recursive: true });
    await fs.writeFile(path.join(goodEnv, 'repo.url'), 'git@example.com:good.git');
    await fs.writeFile(path.join(goodEnv, 'default_branch'), 'main');

    const envs = await orchestrator.listEnvs();
    expect(envs).toHaveLength(1);
    expect(envs[0].envId).toBe('good');
  });
});
