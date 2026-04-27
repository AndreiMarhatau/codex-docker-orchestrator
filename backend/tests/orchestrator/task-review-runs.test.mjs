import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn } from '../helpers.mjs';
import { waitForTaskIdle, waitForTaskStatus } from '../helpers/wait.mjs';
import { createCompletedTaskContext } from './task-fixture-helpers.mjs';
import { buildCodexAppServerArgs } from '../../src/shared/codex/app-server-args.js';

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function countReviewStarts(spawn) {
  return spawn.calls.filter((call) =>
    call.messages.some((message) => message.method === 'review/start')
  ).length;
}

function parseLogItems(log) {
  return log
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line).item)
    .filter(Boolean);
}

async function waitForReviewStartCount(spawn, count) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (countReviewStarts(spawn) >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} review starts`);
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
    expect(parseLogItems(log).filter((item) => item.type === 'review')).toHaveLength(2);
    expect(parseLogItems(log).some((item) =>
      item.type === 'agent_message' && /^Review/.test(item.text || '')
    )).toBe(false);
  });
});

describe('task auto review runs', () => {
  it('keeps reviewing tasks active while auto review is in progress', async () => {
    const reviewPaused = createDeferred();
    const releaseReview = createDeferred();
    const spawn = createMockSpawn({
      reviewTexts: ['Please fix the issue.'],
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
    const reviewCall = spawn.calls.find((call) =>
      call.messages.some((message) => message.method === 'review/start')
    );

    expect(result.status).toBe('running');
    expect(result.runs).toHaveLength(2);
    await waitForTaskIdle(orchestrator, taskId);
    const completed = await orchestrator.getTask(taskId);
    expect(completed.status).toBe('completed');
    expect(completed.runs).toHaveLength(2);
    expect(reviewCall?.args).toEqual(buildCodexAppServerArgs());
  });

  it('skips follow-up runs when auto review returns empty output', async () => {
    const spawn = createMockSpawn({ reviewTexts: [''] });
    const exec = createMockExec({ branches: ['main'], statusPorcelain: ' M README.md' });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const result = await orchestrator.runAutoReviewForTask(taskId, 'run-001');
    const completed = await orchestrator.getTask(taskId);

    expect(result).toEqual({ review: '', resumed: false });
    expect(completed.status).toBe('completed');
    expect(completed.runs).toHaveLength(1);
    expect(countReviewStarts(spawn)).toBe(1);
  });

  it('runs a follow-up review after auto-review fixes change files', async () => {
    const execState = {
      statusPorcelain: ' M README.md',
      diffText: `diff --git a/README.md b/README.md
index 0000000..1111111 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
-Old line
+New line`
    };
    const baseExec = createMockExec({ branches: ['main'] });
    const exec = async (command, args, options = {}) => {
      const gitCIndex = command === 'git' ? args.indexOf('-C') : -1;
      const gitCommand = gitCIndex === -1 ? null : args[gitCIndex + 2];
      const gitCommandArgs = gitCIndex === -1 ? [] : args.slice(gitCIndex + 3);
      if (gitCommand === 'status') {
        return { stdout: execState.statusPorcelain, stderr: '', code: 0 };
      }
      if (gitCommand === 'diff' && gitCommandArgs[0] === '--binary') {
        return { stdout: execState.diffText, stderr: '', code: 0 };
      }
      if (
        gitCommand === 'diff' &&
        gitCommandArgs[0] === '--cached' &&
        gitCommandArgs[1] === '--binary'
      ) {
        return { stdout: '', stderr: '', code: 0 };
      }
      return baseExec(command, args, options);
    };
    exec.calls = baseExec.calls;
    exec.threadId = baseExec.threadId;
    const spawn = createMockSpawn({
      reviewTexts: ['Please fix the README regression.', 'Please fix the follow-up issue.'],
      onBeforeTurnComplete: async ({ message }) => {
        if (message?.method === 'turn/start') {
          execState.diffText = `diff --git a/README.md b/README.md
index 0000000..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,3 @@
-Old line
+New line
+Follow-up fix`;
        }
      }
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const meta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath(taskId), 'utf8'));
    await fs.writeFile(
      orchestrator.taskMetaPath(taskId),
      JSON.stringify({ ...meta, autoReview: true }, null, 2)
    );

    const resumed = await orchestrator.runAutoReviewForTask(taskId, 'run-001');

    expect(resumed.status).toBe('running');
    await waitForReviewStartCount(spawn, 2);
    await waitForTaskIdle(orchestrator, taskId);
    const completed = JSON.parse(await fs.readFile(orchestrator.taskMetaPath(taskId), 'utf8'));

    expect(countReviewStarts(spawn)).toBe(2);
    expect(completed.runs).toHaveLength(3);
    expect(completed.runs[0].reviews).toHaveLength(1);
    expect(completed.runs[0].reviews[0].review).toContain('Please fix the README');
    expect(completed.runs[1].reviews).toHaveLength(1);
    expect(completed.runs[1].reviews[0].review).toContain('Please fix the follow-up');
  });
});
