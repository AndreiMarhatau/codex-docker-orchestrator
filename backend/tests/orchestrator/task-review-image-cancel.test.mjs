import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn } from '../helpers.mjs';
import { createCompletedTaskContext } from './task-fixture-helpers.mjs';

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function abortError() {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

describe('task review image readiness cancellation', () => {
  it('cancels promptly while waiting for image readiness', async () => {
    const spawn = createMockSpawn();
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const imageWaitStarted = createDeferred();
    const spawnCount = spawn.calls.length;
    orchestrator.ensureCodexImageReady = ({ signal }) => {
      imageWaitStarted.resolve();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    };

    const reviewPromise = orchestrator.runTaskReview(taskId, { type: 'uncommittedChanges' });
    const guardedReview = reviewPromise.then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await imageWaitStarted.promise;

    await orchestrator.stopTask(taskId);
    const result = await guardedReview;

    expect(result.error).toMatchObject({ name: 'AbortError' });
    expect(spawn.calls).toHaveLength(spawnCount);
    expect(orchestrator.taskRunClaims.has(taskId)).toBe(false);
  });
});
