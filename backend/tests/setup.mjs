import { beforeEach, afterEach } from 'vitest';

const isolatedEnvKeys = ['GIT_CONFIG_GLOBAL', 'DOCKER_HOST', 'DOCKER_SOCK'];

function clearIsolatedEnv() {
  for (const key of isolatedEnvKeys) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearIsolatedEnv();
});

afterEach(() => {
  clearIsolatedEnv();
});
