import { expect } from 'vitest';

export function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

export function expectAppServerCancellation(result) {
  expect(result.error).toEqual(expect.any(Error));
  expect(result.error.message).toMatch(/Codex app-server exited before/);
}
