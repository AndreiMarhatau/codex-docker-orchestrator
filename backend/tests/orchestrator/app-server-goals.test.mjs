import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createManualAppServerSpawn } from '../helpers/app-server-spawn.mjs';

const require = createRequire(import.meta.url);
const { buildCodexAppServerArgs } = require('../../src/shared/codex/app-server-args');
const { runAppServerTurn } = require('../../src/shared/codex/app-server-turn');

function createMemoryTracker() {
  let stdout = '';
  let stderr = '';
  return {
    onStdout(chunk) {
      stdout += chunk.toString();
    },
    onStderr(chunk) {
      stderr += chunk.toString();
    },
    output() {
      return { stdout, stderr };
    }
  };
}

function runGoalTurn(spawn, appServerConfig = {}) {
  const child = spawn('codex-docker', buildCodexAppServerArgs(), { env: {} });
  const tracker = createMemoryTracker();
  const runPromise = runAppServerTurn({
    child,
    tracker,
    prompt: 'Do work',
    workspaceDir: '/workspace/repo',
    appServerConfig: {
      goalObjective: 'Do work',
      ...appServerConfig
    }
  });
  return { runPromise, server: spawn.latestServer(), tracker };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('app-server goal continuation waiting', () => {
  it('does not finalize while an observed continuation turn is still running', async () => {
    const { runPromise, server } = runGoalTurn(createManualAppServerSpawn());
    let settled = false;
    const observedRun = runPromise.then((result) => {
      settled = true;
      return result;
    });

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.completeTurn({ text: 'first turn' });
    server.startContinuationTurn({ turnId: 'turn-continuation' });
    await delay(35);
    expect(settled).toBe(false);

    server.updateGoal({ status: 'complete', objective: 'Do work' });
    await delay(0);
    server.completeTurn({ text: 'second turn' });
    const result = await observedRun;
    expect(result.turn?.id).toBe('turn-continuation');
  });

  it('does not collect continuation notifications twice', async () => {
    const { runPromise, server, tracker } = runGoalTurn(createManualAppServerSpawn());

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.completeTurn({ text: 'first turn' });
    server.startContinuationTurn({ turnId: 'turn-continuation' });
    server.updateGoal({ status: 'complete', objective: 'Do work' });
    await delay(0);
    server.completeTurn({ text: 'second turn' });
    const result = await runPromise;

    expect(result.agentMessages.filter((message) => message === 'second turn')).toHaveLength(1);
    const completedContinuationLogCount = tracker
      .output()
      .stdout
      .split('\n')
      .filter((line) => line.includes('"turn-continuation"') && line.includes('turn.completed'))
      .length;
    expect(completedContinuationLogCount).toBe(1);
  });

  it('consumes fast continuation completions in order', async () => {
    const { runPromise, server } = runGoalTurn(createManualAppServerSpawn());

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.completeTurn({ text: 'first turn' });
    server.startContinuationTurn({ turnId: 'turn-continuation-1' });
    server.completeTurn({ text: 'second turn' });
    server.startContinuationTurn({ turnId: 'turn-continuation-2' });
    server.completeTurn({ text: 'third turn' });
    await delay(0);
    server.updateGoal({ status: 'complete', objective: 'Do work' });
    const result = await runPromise;

    expect(result.turn?.id).toBe('turn-continuation-2');
  });

  it('waits for a trailing goal completion notification before continuing', async () => {
    const { runPromise, server } = runGoalTurn(createManualAppServerSpawn());

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.completeTurn({ text: 'done' });
    await delay(0);
    server.updateGoal({ status: 'complete', objective: 'Do work' });
    const result = await runPromise;

    expect(result.code).toBe(0);
    expect(result.goal?.status).toBe('complete');
  });

  it('clears a requested goal after starting the user turn', async () => {
    const spawn = createManualAppServerSpawn();
    const { runPromise, server } = runGoalTurn(spawn, {
      clearGoal: true,
      goalObjective: ''
    });

    await server.waitForTurnStart();
    server.completeTurn({ text: 'completed after clear' });
    const result = await runPromise;
    const goalClearIndex = server.call.messages.findIndex((message) =>
      message.method === 'thread/goal/clear'
    );
    const turnStartIndex = server.call.messages.findIndex((message) =>
      message.method === 'turn/start'
    );

    expect(result.code).toBe(0);
    expect(result.goal).toBeNull();
    expect(goalClearIndex).toBeLessThan(turnStartIndex);
  });

  it('returns a failed turn without waiting for goal continuation', async () => {
    const { runPromise, server } = runGoalTurn(createManualAppServerSpawn());

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.completeTurn({
      status: 'failed',
      error: { message: 'usage limit' },
      text: 'failed'
    });
    const result = await runPromise;

    expect(result.code).toBe(1);
    expect(result.turn?.status).toBe('failed');
  });

  it('rejects immediately when the app-server closes before completion wait starts', async () => {
    const { runPromise, server } = runGoalTurn(createManualAppServerSpawn());

    await server.waitForTurnStart();
    await server.waitForGoalSet();
    server.close(1, null);

    await expect(runPromise).rejects.toThrow('Codex app-server exited before turn completed');
  });
});
