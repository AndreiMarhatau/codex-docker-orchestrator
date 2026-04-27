import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn } from '../helpers.mjs';
import { createCompletedTaskContext } from './task-fixture-helpers.mjs';
import {
  createDeferred,
  expectAppServerCancellation
} from './task-mutation-cancel-helpers.mjs';

describe('task mutation app-server cancellation on stop', () => {
  it('does not commit when an existing transition claim has already been stopped', async () => {
    const spawn = createMockSpawn({ recordStructuredCodex: true });
    const exec = createMockExec({
      branches: ['main'],
      statusPorcelain: ' M README.md\n',
      diffHasChanges: true
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const releaseTaskRunTransition = orchestrator.claimTaskRunTransition(taskId);
    releaseTaskRunTransition.claim.stopRequested = true;
    try {
      await expect(
        orchestrator.commitAndPushTask(taskId, {
          message: 'Manual commit message',
          transitionClaim: releaseTaskRunTransition
        })
      ).rejects.toMatchObject({ code: 'TASK_BUSY' });
    } finally {
      releaseTaskRunTransition();
    }

    expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('commit')))
      .toBe(false);
  });

  it('escalates stuck generated commit message runs and releases the claim', async () => {
    const commitPaused = createDeferred();
    const spawn = createMockSpawn({
      ignoreSigterm: true,
      recordStructuredCodex: true,
      onBeforeTurnComplete: async ({ message, options }) => {
        if (options?.env?.ORCH_STRUCTURED_CODEX === '1' && message.params?.outputSchema) {
          commitPaused.resolve();
          await new Promise(() => {});
        }
      }
    });
    const exec = createMockExec({
      branches: ['main'],
      statusPorcelain: ' M README.md\n',
      diffHasChanges: true
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const guardedCommit = orchestrator.commitAndPushTask(taskId).then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await commitPaused.promise;

    await orchestrator.stopTask(taskId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await guardedCommit;

    const structuredCall = spawn.calls.find(
      (call) => call.options?.env?.ORCH_STRUCTURED_CODEX === '1'
    );
    expectAppServerCancellation(result);
    expect(structuredCall?.child?.killedSignals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('commit')))
      .toBe(false);

    await orchestrator.deleteTask(taskId);
    await expect(fs.stat(orchestrator.taskDir(taskId))).rejects.toThrow();
  });

  it('does not commit if stop races with a completed generated commit message', async () => {
    const commitPaused = createDeferred();
    const releaseCommit = createDeferred();
    const spawn = createMockSpawn({
      ignoreSigterm: true,
      recordStructuredCodex: true,
      onBeforeTurnComplete: async ({ message, options }) => {
        if (options?.env?.ORCH_STRUCTURED_CODEX === '1' && message.params?.outputSchema) {
          commitPaused.resolve();
          await releaseCommit.promise;
        }
      }
    });
    const exec = createMockExec({
      branches: ['main'],
      statusPorcelain: ' M README.md\n',
      diffHasChanges: true
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    orchestrator.appServerShutdownTimeoutMs = 1000;

    const guardedCommit = orchestrator.commitAndPushTask(taskId).then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await commitPaused.promise;

    await orchestrator.stopTask(taskId);
    releaseCommit.resolve();
    const result = await guardedCommit;

    expect(result.error).toMatchObject({ code: 'TASK_BUSY' });
    expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('commit')))
      .toBe(false);
    expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('push')))
      .toBe(false);
  });
});
