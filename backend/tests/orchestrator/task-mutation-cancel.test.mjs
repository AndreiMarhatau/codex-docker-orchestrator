import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn } from '../helpers.mjs';
import { createCompletedTaskContext } from './task-fixture-helpers.mjs';
import { waitForTaskIdle, waitForTaskStatus } from '../helpers/wait.mjs';
import { createDeferred } from './task-mutation-cancel-helpers.mjs';

describe('task mutation app-server cancellation', () => {
  it('generates commit messages, commits, and pushes while holding one claim', async () => {
    const spawn = createMockSpawn({ recordStructuredCodex: true });
    const exec = createMockExec({
      branches: ['main'],
      statusPorcelain: ' M README.md\n',
      diffHasChanges: true
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });
    const originalRepo = process.env.ORCH_GITHUB_REPO;
    delete process.env.ORCH_GITHUB_REPO;
    try {
      const result = await orchestrator.commitAndPushTask(taskId);

      expect(result).toMatchObject({
        pushed: true,
        prCreated: false,
        committed: true,
        commitMessage: 'Update mock task'
      });
      expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('commit')))
        .toBe(true);
      expect(spawn.calls.some((call) => call.options?.env?.ORCH_STRUCTURED_CODEX === '1'))
        .toBe(true);
    } finally {
      if (originalRepo === undefined) {
        delete process.env.ORCH_GITHUB_REPO;
      } else {
        process.env.ORCH_GITHUB_REPO = originalRepo;
      }
    }
  });

  it('skips commit and push work when unchanged task output is already pushed', async () => {
    const spawn = createMockSpawn({ recordStructuredCodex: true });
    const exec = createMockExec({
      branches: ['main'],
      statusPorcelain: '',
      diffHasChanges: false
    });
    const { orchestrator, taskId } = await createCompletedTaskContext({ exec, spawn });

    const result = await orchestrator.commitAndPushTask(taskId);

    expect(result).toEqual({
      pushed: true,
      prCreated: false,
      committed: false,
      commitMessage: null
    });
    expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('commit')))
      .toBe(false);
    expect(spawn.calls).toHaveLength(0);
  });
});

describe('task async commit push runs', () => {
  it('starts commit and push asynchronously while generated commit message work continues', async () => {
    const commitPaused = createDeferred();
    const releaseCommit = createDeferred();
    const spawn = createMockSpawn({
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
    const originalRepo = process.env.ORCH_GITHUB_REPO;
    delete process.env.ORCH_GITHUB_REPO;
    try {
      const result = await orchestrator.startCommitAndPushTask(taskId);
      expect(result).toEqual({ started: true });

      await commitPaused.promise;
      const pushing = await waitForTaskStatus(orchestrator, taskId, 'pushing');
      expect(pushing.error).toBeNull();
      await expect(orchestrator.stopTask(taskId)).resolves.toMatchObject({ status: 'pushing' });
      expect(orchestrator.getTaskRunTransitionClaim(taskId).stopRequested).toBe(false);

      releaseCommit.resolve();
      await waitForTaskIdle(orchestrator, taskId);
      const completed = await waitForTaskStatus(orchestrator, taskId, 'completed');

      expect(completed.runLogs[0].entries.some((entry) =>
        entry.parsed?.item?.text?.includes('Commit & push completed.')
      )).toBe(true);
      expect(exec.calls.some((call) => call.command === 'git' && call.args.includes('push')))
        .toBe(true);
    } finally {
      if (originalRepo === undefined) {
        delete process.env.ORCH_GITHUB_REPO;
      } else {
        process.env.ORCH_GITHUB_REPO = originalRepo;
      }
    }
  });
});
