import { isCodexAppServerArgs } from '../../src/shared/codex/app-server-args.js';
import {
  attachAppServerResponder,
  createChild,
} from './auto-rotate-app-server.mjs';
import { emitSuccess, emitUsageLimit } from './auto-rotate-legacy-output.mjs';

function createUsageLimitConsumer(options, onBeforeLimit, state) {
  return async () => {
    if (options?.env?.ORCH_STRUCTURED_CODEX === '1') {
      return false;
    }
    if (state.runCount !== 0) {
      state.runCount += 1;
      return false;
    }
    if (onBeforeLimit) {
      await onBeforeLimit();
    }
    state.runCount += 1;
    return true;
  };
}

function emitLegacyCodexResult(child, args, onBeforeLimit, state) {
  const isResume = args.includes('resume');
  setImmediate(async () => {
    if (state.runCount === 0) {
      if (onBeforeLimit) {
        await onBeforeLimit();
      }
      emitUsageLimit(child);
    } else {
      emitSuccess(child, isResume);
    }
    state.runCount += 1;
  });
}

export function buildSpawnWithUsageLimit({
  spawnCalls,
  onBeforeLimit,
  rateLimitsByToken = {},
  refreshedAuthByToken = null,
  refreshedAuthRawByToken = null
}) {
  const state = { runCount: 0 };
  return (command, args, options = {}) => {
    const call = { command, args, options, messages: [] };
    if (options?.env?.ORCH_STRUCTURED_CODEX !== '1') {
      spawnCalls.push(call);
    }
    const child = createChild();
    if (command === 'codex-docker' && isCodexAppServerArgs(args)) {
      attachAppServerResponder(child, options, {
        rateLimitsByToken,
        refreshedAuthByToken,
        refreshedAuthRawByToken,
        consumeUsageLimit: createUsageLimitConsumer(options, onBeforeLimit, state)
      }, call);
      return child;
    }
    emitLegacyCodexResult(child, args, onBeforeLimit, state);
    return child;
  };
}
