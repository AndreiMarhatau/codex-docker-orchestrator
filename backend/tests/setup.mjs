import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  delete process.env.GIT_CONFIG_GLOBAL;
});

afterEach(() => {
  delete process.env.GIT_CONFIG_GLOBAL;
});
