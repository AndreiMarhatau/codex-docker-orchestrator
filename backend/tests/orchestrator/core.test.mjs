import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator core', () => {
  it('wraps git exec with credential helper', async () => {
    process.env.ORCH_GIT_CREDENTIAL_HELPER = 'test-helper';
    const calls = [];
    const exec = async (command, args) => {
      calls.push({ command, args });
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    await orchestrator.exec('git', ['status']);
    const gitCall = calls.find((call) => call.command === 'git');
    expect(gitCall.args).toEqual([
      '-c',
      'credential.helper=',
      '-c',
      'credential.helper=test-helper',
      'status'
    ]);
    delete process.env.ORCH_GIT_CREDENTIAL_HELPER;
  });

  it('uses docker socket overrides and validates path', async () => {
    const socketDir = await createTempDir();
    const socketPath = path.join(socketDir, 'docker.sock');
    await fs.writeFile(socketPath, '');
    process.env.DOCKER_SOCK = socketPath;
    const orchestrator = new Orchestrator();
    expect(orchestrator.dockerSocketPath()).toBe(socketPath);
    expect(orchestrator.requireDockerSocket()).toBe(socketPath);
    delete process.env.DOCKER_SOCK;
  });

  it('throws when docker socket is missing', () => {
    process.env.DOCKER_SOCK = '/tmp/missing.sock';
    const orchestrator = new Orchestrator();
    expect(() => orchestrator.requireDockerSocket()).toThrow(/Docker socket not found/);
    delete process.env.DOCKER_SOCK;
  });

  it('uses sane docker startup defaults and allows explicit override', () => {
    const defaultOrchestrator = new Orchestrator();
    expect(defaultOrchestrator.taskDockerReadyTimeoutMs).toBe(600_000);
    expect(defaultOrchestrator.taskDockerCommandTimeoutMs).toBe(600_000);

    const overrideOrchestrator = new Orchestrator({
      taskDockerReadyTimeoutMs: 15_000,
      taskDockerCommandTimeoutMs: 5_000
    });
    expect(overrideOrchestrator.taskDockerReadyTimeoutMs).toBe(15_000);
    expect(overrideOrchestrator.taskDockerCommandTimeoutMs).toBe(5_000);
  });

  it('falls back to documented docker command timeout default for invalid value', () => {
    const orchestrator = new Orchestrator({ taskDockerCommandTimeoutMs: 'invalid' });
    expect(orchestrator.taskDockerCommandTimeoutMs).toBe(600_000);
  });

  it('allows disabling docker command timeout with zero', () => {
    const orchestrator = new Orchestrator({ taskDockerCommandTimeoutMs: 0 });
    expect(orchestrator.taskDockerCommandTimeoutMs).toBe(0);
  });

  it('preserves inherited GIT_CONFIG_GLOBAL when no baseEnv override is provided', () => {
    const originalGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = '/external/gitconfig';
    const orchestrator = new Orchestrator({
      dataRoot: '/managed-root',
      orchHome: '/managed-root/.codex-orchestrator',
      codexHome: '/managed-root/.codex'
    });

    expect(orchestrator.withRuntimeEnv().GIT_CONFIG_GLOBAL).toBe('/external/gitconfig');

    if (originalGitConfigGlobal === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = originalGitConfigGlobal;
    }
  });

  it('preserves an explicit baseEnv GIT_CONFIG_GLOBAL override', () => {
    const orchestrator = new Orchestrator({
      dataRoot: '/managed-root',
      orchHome: '/managed-root/.codex-orchestrator',
      codexHome: '/managed-root/.codex'
    });

    const env = orchestrator.withRuntimeEnv({ GIT_CONFIG_GLOBAL: '/caller/gitconfig' });
    expect(env.GIT_CONFIG_GLOBAL).toBe('/caller/gitconfig');
  });
});
