import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { createCompletedTaskContext } from './task-fixture-helpers.mjs';
import { buildCodexAppServerArgs } from '../../src/orchestrator/app-server-args.js';

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function expectAppServerCancellation(result) {
  expect(result.error).toEqual(expect.any(Error));
  expect(result.error.message).toMatch(/Codex app-server exited before/);
}

describe('task async manual review runs', () => {
  it('starts manual reviews asynchronously and restores task status', async () => {
    const spawn = createMockSpawn({ turnCompletionDelayMs: 50 });
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const result = await orchestrator.startTaskReview(taskId, { type: 'uncommittedChanges' });
    const reviewing = await orchestrator.getTask(taskId);

    expect(result).toEqual({
      started: true,
      target: { type: 'uncommittedChanges' }
    });
    expect(reviewing.status).toBe('reviewing');
    expect(orchestrator.taskRunClaims.has(taskId)).toBe(true);

    const completed = await waitForTaskStatus(orchestrator, taskId, 'completed');
    const log = await fs.readFile(
      path.join(orchestrator.taskLogsDir(taskId), 'run-001.jsonl'),
      'utf8'
    );

    expect(orchestrator.taskRunClaims.has(taskId)).toBe(false);
    expect(completed.runs[0].reviews).toHaveLength(1);
    expect(log).toContain('Review started: uncommitted changes');
    expect(log).toContain('Review: uncommitted changes');
  });
});

describe('task auto review runs', () => {
  it('keeps reviewing tasks active while auto review is in progress', async () => {
    const reviewPaused = createDeferred();
    const releaseReview = createDeferred();
    const spawn = createMockSpawn({
      onBeforeTurnComplete: async ({ message }) => {
        if (message?.method === 'review/start') {
          reviewPaused.resolve();
          await releaseReview.promise;
        }
      }
    });
    const exec = createMockExec({ branches: ['main'], statusPorcelain: ' M README.md' });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const reviewPromise = orchestrator.runAutoReviewForTask(taskId, 'run-001');
    await reviewPaused.promise;
    const reviewing = await orchestrator.getTask(taskId);

    expect(reviewing.status).toBe('reviewing');
    expect(reviewing.error).toBeNull();
    expect(orchestrator.taskRunClaims.has(taskId)).toBe(true);

    releaseReview.resolve();
    const result = await reviewPromise;
    const completed = await orchestrator.getTask(taskId);
    const reviewCall = spawn.calls.find((call) =>
      call.messages.some((message) => message.method === 'review/start')
    );

    expect(result).toEqual({ review: 'No findings.', resumed: false });
    expect(completed.status).toBe('completed');
    expect(reviewCall?.args).toEqual(buildCodexAppServerArgs());
  });
});

describe('task manual review runs', () => {
  it('escalates stuck manual review runs and releases the claim', async () => {
    const reviewPaused = createDeferred();
    const spawn = createMockSpawn({
      ignoreSigterm: true,
      onBeforeTurnComplete: async ({ message }) => {
        if (message?.method === 'review/start') {
          reviewPaused.resolve();
          await new Promise(() => {});
        }
      }
    });
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const reviewPromise = orchestrator.runTaskReview(taskId, { type: 'uncommittedChanges' });
    const guardedReview = reviewPromise.then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await reviewPaused.promise;

    await orchestrator.stopTask(taskId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expectAppServerCancellation(await guardedReview);

    const reviewCall = spawn.calls.find((call) =>
      call.messages.some((message) => message.method === 'review/start')
    );
    expect(reviewCall?.child?.killedSignals).toEqual(['SIGTERM', 'SIGKILL']);

    await orchestrator.deleteTask(taskId);
    await expect(fs.stat(orchestrator.taskDir(taskId))).rejects.toThrow();
  });

  it('does not append review output if stop races with a completed review', async () => {
    const reviewPaused = createDeferred();
    const releaseReview = createDeferred();
    const spawn = createMockSpawn({
      ignoreSigterm: true,
      onBeforeTurnComplete: async ({ message }) => {
        if (message?.method === 'review/start') {
          reviewPaused.resolve();
          await releaseReview.promise;
        }
      }
    });
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    orchestrator.appServerShutdownTimeoutMs = 1000;

    const reviewPromise = orchestrator.runTaskReview(taskId, { type: 'uncommittedChanges' });
    const guardedReview = reviewPromise.then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await reviewPaused.promise;

    await orchestrator.stopTask(taskId);
    releaseReview.resolve();
    const result = await guardedReview;
    const meta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath(taskId), 'utf8'));
    const log = await fs.readFile(
      path.join(orchestrator.taskLogsDir(taskId), 'run-001.jsonl'),
      'utf8'
    );

    expect(result.error).toMatchObject({ code: 'TASK_BUSY' });
    expect(meta.runs[0].reviews || []).toHaveLength(0);
    expect(log).not.toContain('Review: uncommitted changes');
  });

  it('records completed manual reviews on the latest run', async () => {
    const spawn = createMockSpawn();
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const targets = [
      { type: 'baseBranch', branch: 'main' },
      { type: 'uncommittedChanges' },
      { type: 'commit', sha: 'abc123' },
      { type: 'custom', instructions: 'inspect auth' }
    ];
    const results = [];
    for (const target of targets) {
      results.push(await orchestrator.runTaskReview(taskId, target));
    }
    const meta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath(taskId), 'utf8'));
    const log = await fs.readFile(
      path.join(orchestrator.taskLogsDir(taskId), 'run-001.jsonl'),
      'utf8'
    );

    expect(results.every((result) => result.review === 'No findings.')).toBe(true);
    expect(meta.runs[0].reviews[0].target).toEqual({ type: 'baseBranch', branch: 'main' });
    expect(meta.runs[0].reviews).toHaveLength(4);
    expect(log).toContain('Review: changes against main');
    expect(log).toContain('Review: uncommitted changes');
    expect(log).toContain('Review: commit abc123');
    expect(log).toContain('Review: custom review');
  });

  it('rejects manual reviews when task metadata cannot support review', async () => {
    const spawn = createMockSpawn();
    const exec = createMockExec({ branches: ['main'] });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const meta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath(taskId), 'utf8'));

    await fs.writeFile(
      orchestrator.taskMetaPath(taskId),
      JSON.stringify({ ...meta, threadId: null }, null, 2)
    );
    await expect(orchestrator.runTaskReview(taskId, { type: 'uncommittedChanges' }))
      .rejects.toThrow(/without a Codex thread/);

    await fs.writeFile(
      orchestrator.taskMetaPath(taskId),
      JSON.stringify({ ...meta, runs: [] }, null, 2)
    );
    await expect(orchestrator.runTaskReview(taskId, { type: 'uncommittedChanges' }))
      .rejects.toThrow(/without a run/);
  });
});
