import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseJsonObject, runStructuredCodex } = require('../../src/shared/codex/structured-output');

function abortError() {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

async function waitForValue(readValue) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const value = readValue();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for value');
}

describe('structured output parsing', () => {
  it('parses direct and embedded JSON objects', () => {
    expect(parseJsonObject('{"message":"ok"}')).toEqual({ message: 'ok' });
    expect(parseJsonObject('prefix {"message":"ok"} suffix')).toEqual({ message: 'ok' });
  });

  it('returns null for empty or malformed structured output', () => {
    expect(parseJsonObject('')).toBeNull();
    expect(parseJsonObject(null)).toBeNull();
    expect(parseJsonObject({ message: 'ok' })).toBeNull();
    expect(parseJsonObject('plain text')).toBeNull();
    expect(parseJsonObject('prefix {bad json} suffix')).toBeNull();
  });

  it('registers task cancellation before waiting for image readiness', async () => {
    let cancel = null;
    let imageWaitStarted = false;
    const orchestrator = {
      appServerShutdownTimeoutMs: 1000,
      ensureCodexImageReady({ signal }) {
        imageWaitStarted = true;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(abortError()), { once: true });
        });
      },
      registerTaskRunTransitionCancel(_taskId, callback) {
        cancel = callback;
        return () => {};
      },
      spawn() {
        throw new Error('spawn should not be reached');
      }
    };
    const runPromise = runStructuredCodex({
      orchestrator,
      taskId: 'task-1',
      cwd: '/tmp',
      workspaceDir: '/workspace/repo',
      artifactsDir: '/tmp/artifacts',
      prompt: 'Generate JSON',
      developerInstructions: '',
      outputSchema: { type: 'object' }
    });

    await waitForValue(() => cancel && imageWaitStarted);
    cancel();

    await expect(runPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
