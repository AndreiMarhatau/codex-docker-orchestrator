import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { buildRunEnv } = require('../../src/orchestrator/tasks/run-helpers');
const {
  DEFAULT_GIT_CONFIG_CONTAINER_PATH,
  DEFAULT_INNER_ARTIFACTS_DIR,
  DEFAULT_INNER_CODEX_HOME
} = require('../../src/orchestrator/constants');

function createOrchestrator(root) {
  return {
    codexHome: path.join(root, 'codex'),
    withRuntimeEnv(baseEnv = null) {
      return { ...(baseEnv || process.env) };
    },
    volumeMountFor(sourcePath, targetPath, readOnly = false) {
      const relative = path.relative(root, sourcePath).split(path.sep).join('/');
      return `orch-data/${relative}=${targetPath}${readOnly ? ':ro' : ''}`;
    },
    gitConfigVolumeMount() {
      return 'orch-data/git=/orchestrator-git:ro';
    }
  };
}

describe('run helpers env', () => {
  it('builds run environment with volume mounts', async () => {
    const root = await createTempDir();
    const orchestrator = createOrchestrator(root);
    const codexHome = orchestrator.codexHome;
    const artifactsDir = path.join(root, 'artifacts');
    const sharedPath = path.join(root, 'shared');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(sharedPath, { recursive: true });

    const env = buildRunEnv({
      orchestrator,
      workspaceDir: '/workspace/repo',
      artifactsDir,
      volumeMounts: [
        orchestrator.volumeMountFor(sharedPath, '/workspace/shared'),
        orchestrator.volumeMountFor(sharedPath, '/readonly/shared', true)
      ]
    });

    expect(env.CODEX_WORKSPACE_DIR).toBe('/workspace/repo');
    expect(env.GIT_CONFIG_GLOBAL).toBe(DEFAULT_GIT_CONFIG_CONTAINER_PATH);
    expect(env.CODEX_VOLUME_MOUNTS).toContain(`orch-data/codex=${DEFAULT_INNER_CODEX_HOME}`);
    expect(env.CODEX_VOLUME_MOUNTS).toContain(`orch-data/artifacts=${DEFAULT_INNER_ARTIFACTS_DIR}`);
    expect(env.CODEX_VOLUME_MOUNTS).toContain('orch-data/git=/orchestrator-git:ro');
    expect(env.CODEX_VOLUME_MOUNTS).toContain('orch-data/shared=/workspace/shared');
    expect(env.CODEX_VOLUME_MOUNTS).toContain('orch-data/shared=/readonly/shared:ro');
  });

  it('does not emit legacy bind-mount variables', async () => {
    const root = await createTempDir();
    const orchestrator = createOrchestrator(root);
    const codexHome = orchestrator.codexHome;
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_MOUNT_PATHS = '';
    process.env.CODEX_MOUNT_PATHS_RO = '';
    process.env.CODEX_MOUNT_MAPS = '';
    process.env.CODEX_MOUNT_MAPS_RO = '';

    const env = buildRunEnv({
      orchestrator,
      workspaceDir: '/workspace/repo',
      artifactsDir,
      volumeMounts: []
    });

    expect(env.CODEX_VOLUME_MOUNTS).toContain(`orch-data/codex=${DEFAULT_INNER_CODEX_HOME}`);
    expect(env.CODEX_VOLUME_MOUNTS).toContain(`orch-data/artifacts=${DEFAULT_INNER_ARTIFACTS_DIR}`);
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
    const orchestrator = createOrchestrator(root);
    const codexHome = orchestrator.codexHome;
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_PASSTHROUGH_ENV = 'EXISTING_VAR';

    const env = buildRunEnv({
      orchestrator,
      workspaceDir: '/workspace/repo',
      artifactsDir,
      envOverrides: { SAMPLE_FLAG: 'alpha=bravo', PATH: '/custom/bin' }
    });

    expect(env.SAMPLE_FLAG).toBe('alpha=bravo');
    expect(env.PATH).toBe('/custom/bin');
    expect(env.CODEX_PASSTHROUGH_ENV.split(',')).toEqual(
      expect.arrayContaining(['EXISTING_VAR', 'GIT_CONFIG_GLOBAL', 'GH_TOKEN', 'SAMPLE_FLAG', 'PATH'])
    );
    delete process.env.CODEX_PASSTHROUGH_ENV;
  });

  it('keeps CODEX_CONTAINER_ENV overrides out of passthrough forwarding', async () => {
    const root = await createTempDir();
    const orchestrator = createOrchestrator(root);
    const codexHome = orchestrator.codexHome;
    const artifactsDir = path.join(root, 'artifacts');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });
    process.env.CODEX_PASSTHROUGH_ENV = 'EXISTING_VAR';

    const env = buildRunEnv({
      orchestrator,
      workspaceDir: '/workspace/repo',
      artifactsDir,
      envOverrides: {
        CODEX_CONTAINER_ENV_DOCKER_HOST: 'unix:///var/run/orch-task-docker/docker.sock',
        SAMPLE_FLAG: 'alpha'
      }
    });

    expect(env.CODEX_CONTAINER_ENV_DOCKER_HOST).toBe('unix:///var/run/orch-task-docker/docker.sock');
    expect(env.CODEX_PASSTHROUGH_ENV.split(',')).toEqual(
      expect.arrayContaining(['EXISTING_VAR', 'GIT_CONFIG_GLOBAL', 'GH_TOKEN', 'SAMPLE_FLAG'])
    );
    expect(env.CODEX_PASSTHROUGH_ENV.split(',')).not.toContain('CODEX_CONTAINER_ENV_DOCKER_HOST');
    delete process.env.CODEX_PASSTHROUGH_ENV;
  });
});
