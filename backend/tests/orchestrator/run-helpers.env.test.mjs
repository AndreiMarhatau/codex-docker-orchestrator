import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { buildRunEnv } = require('../../src/orchestrator/tasks/run-helpers');

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
      mountMaps: [{ source: sharedPath, target: '/workspace/shared' }],
      mountMapsRo: [{ source: sharedPath, target: '/readonly/shared' }],
      agentsAppendFile: null
    });

    expect(env.CODEX_MOUNT_PATHS).toContain(codexHome);
    expect(env.CODEX_MOUNT_PATHS).toContain(artifactsDir);
    expect(env.CODEX_MOUNT_PATHS).toContain(sharedPath);
    expect(env.CODEX_MOUNT_PATHS_RO || '').not.toContain(sharedPath);
    expect(env.CODEX_MOUNT_MAPS).toContain(`${sharedPath}=/workspace/shared`);
    expect(env.CODEX_MOUNT_MAPS_RO).toContain(`${sharedPath}=/readonly/shared`);
  });

  it('clears empty mount variables', async () => {
    const root = await createTempDir();
    const codexHome = path.join(root, 'codex');
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_MOUNT_PATHS = '';
    process.env.CODEX_MOUNT_PATHS_RO = '';
    process.env.CODEX_MOUNT_MAPS = '';
    process.env.CODEX_MOUNT_MAPS_RO = '';

    const env = buildRunEnv({
      codexHome,
      artifactsDir,
      mountPaths: [],
      mountPathsRo: [],
      mountMaps: [],
      mountMapsRo: [],
      agentsAppendFile: null
    });

    expect(env.CODEX_MOUNT_PATHS).toContain(codexHome);
    expect(env.CODEX_MOUNT_PATHS).toContain(artifactsDir);
    expect(env.CODEX_MOUNT_PATHS_RO).toBeUndefined();
    expect(env.CODEX_MOUNT_MAPS).toBeUndefined();
    expect(env.CODEX_MOUNT_MAPS_RO).toBeUndefined();
    delete process.env.CODEX_MOUNT_PATHS;
    delete process.env.CODEX_MOUNT_PATHS_RO;
    delete process.env.CODEX_MOUNT_MAPS;
    delete process.env.CODEX_MOUNT_MAPS_RO;
  });

  it('applies env overrides and extends passthrough list', async () => {
    const root = await createTempDir();
    const codexHome = path.join(root, 'codex');
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_PASSTHROUGH_ENV = 'EXISTING_VAR';

    const env = buildRunEnv({
      codexHome,
      artifactsDir,
      mountPaths: [],
      mountPathsRo: [],
      agentsAppendFile: null,
      envOverrides: { SAMPLE_FLAG: 'alpha=bravo', PATH: '/custom/bin' }
    });

    expect(env.SAMPLE_FLAG).toBe('alpha=bravo');
    expect(env.PATH).toBe('/custom/bin');
    expect(env.CODEX_PASSTHROUGH_ENV.split(',')).toEqual(
      expect.arrayContaining(['EXISTING_VAR', 'SAMPLE_FLAG', 'PATH'])
    );
    delete process.env.CODEX_PASSTHROUGH_ENV;
  });
});
