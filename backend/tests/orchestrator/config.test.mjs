import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveConfig } = require('../../src/orchestrator/config');

describe('orchestrator config resolution', () => {
  const originalEnv = {
    ORCH_DATA_DIR: process.env.ORCH_DATA_DIR,
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL
  };

  afterEach(() => {
    if (originalEnv.ORCH_DATA_DIR === undefined) {
      delete process.env.ORCH_DATA_DIR;
    } else {
      process.env.ORCH_DATA_DIR = originalEnv.ORCH_DATA_DIR;
    }

    if (originalEnv.GIT_CONFIG_GLOBAL === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = originalEnv.GIT_CONFIG_GLOBAL;
    }
  });

  it('infers the shared data root from explicit orchHome and codexHome', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    const config = resolveConfig({
      orchHome: '/explicit-root/.codex-orchestrator',
      codexHome: '/explicit-root/.codex'
    });
    expect(config.dataRoot).toBe('/explicit-root');
  });

  it('preserves ORCH_DATA_DIR when explicit homes are inside it', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    const config = resolveConfig({
      orchHome: '/env-root/.codex-orchestrator',
      codexHome: '/env-root/.codex'
    });
    expect(config.dataRoot).toBe('/env-root');
  });

  it('uses explicit orchHome as data root when no codexHome is provided', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    const config = resolveConfig({ orchHome: '/explicit-orch-home' });
    expect(config.dataRoot).toBe('/explicit-orch-home');
  });

  it('ignores inherited GIT_CONFIG_GLOBAL from the environment', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    process.env.GIT_CONFIG_GLOBAL = '/env-root/git/custom.gitconfig';
    const config = resolveConfig({});
    expect(config.gitConfigGlobalPath).toBe(path.join('/env-root', 'git', '.gitconfig'));
  });

  it('falls back to the default git config path when env path is outside data root', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    process.env.GIT_CONFIG_GLOBAL = '/outside/gitconfig';
    const config = resolveConfig({});
    expect(config.gitConfigGlobalPath).toBe(path.join('/env-root', 'git', '.gitconfig'));
  });

  it('allows an explicit git config override outside the data root', () => {
    process.env.ORCH_DATA_DIR = '/env-root';
    process.env.GIT_CONFIG_GLOBAL = '/outside/gitconfig';
    const config = resolveConfig({
      dataRoot: '/explicit-root',
      gitConfigGlobalPath: '/custom/location/.gitconfig'
    });
    expect(config.gitConfigGlobalPath).toBe('/custom/location/.gitconfig');
  });
});
