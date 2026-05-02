const fs = require('node:fs');
const path = require('node:path');
const { buildCodexAppServerArgs } = require('../../../../shared/codex/app-server-args');
const { buildRunEnv } = require('../../../../shared/codex/run-env');
const { runAppServerTurn } = require('../../../../shared/codex/app-server-turn');
const { computeGitFingerprint } = require('../../../../shared/git/fingerprint');
const { createBoundedChildShutdown } = require('../../../../shared/process/shutdown');
const { createOutputTracker } = require('../run-helpers');
const { beginTaskRunFinalization } = require('./transition');

function createRunProcess(orchestrator, options) {
  const artifactsDir = orchestrator.runArtifactsDir(options.taskId, options.runLabel);
  const env = buildRunEnv({
    orchestrator,
    workspaceDir: options.workspaceDir,
    artifactsDir,
    volumeMounts: options.volumeMounts,
    envOverrides: options.envOverrides
  });
  const useProcessGroup = process.platform !== 'win32';
  const child = orchestrator.spawn('codex-docker', buildCodexAppServerArgs(), {
    cwd: options.cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: useProcessGroup
  });
  const shutdown = createBoundedChildShutdown({
    child,
    useProcessGroup,
    stopTimeoutMs: orchestrator.appServerShutdownTimeoutMs
  });
  return { child, shutdown, useProcessGroup };
}

function createRunStreams(orchestrator, taskId, runLabel) {
  const logPath = path.join(orchestrator.taskLogsDir(taskId), `${runLabel}.jsonl`);
  const stderrPath = path.join(orchestrator.taskLogsDir(taskId), `${runLabel}.stderr`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
  const tracker = createOutputTracker({ logStream, stderrStream });
  return { logStream, stderrStream, tracker };
}

async function stopSidecarOnExit(orchestrator, taskId, tracker, enabled) {
  if (!enabled || orchestrator.running.has(taskId)) {
    return;
  }
  try {
    await orchestrator.stopTaskDockerSidecar(taskId);
  } catch (error) {
    tracker.onStderr(
      Buffer.from(`\nFailed to stop task Docker sidecar: ${error?.message || 'Unknown error'}`)
    );
  }
}

function createFinalizeRun(orchestrator, options, streams, runState) {
  let finalized = false;
  return async (code, signal) => {
    if (finalized) {
      return;
    }
    finalized = true;
    const releaseFinalizing = beginTaskRunFinalization(orchestrator, options.taskId);
    if (runState.stopTimeout) {
      clearTimeout(runState.stopTimeout);
    }
    try {
      if (orchestrator.running.get(options.taskId) === runState) {
        orchestrator.running.delete(options.taskId);
      }
      const result = { ...streams.tracker.getResult(), ...(runState.resultOverrides || {}) };
      result.code = code ?? 1;
      result.stopped =
        runState.stopRequested ||
        orchestrator.getFinalizingTaskRun(options.taskId)?.stopRequested === true ||
        signal === 'SIGTERM' ||
        signal === 'SIGKILL';
      await orchestrator.finalizeRun(options.taskId, options.runLabel, result, options.prompt);
    } finally {
      await stopSidecarOnExit(
        orchestrator,
        options.taskId,
        streams.tracker,
        options.stopTaskDockerSidecarOnExit
      );
      streams.logStream.end();
      streams.stderrStream.end();
      releaseFinalizing();
    }
  };
}

async function runCodexTurn({ orchestrator, options, processInfo, tracker, finalize, runState }) {
  try {
    runState.gitFingerprintBefore = await computeGitFingerprint(orchestrator.exec, options.cwd);
    const turnResult = await runAppServerTurn({
      child: processInfo.child,
      tracker,
      prompt: options.codexPrompt ?? options.prompt,
      workspaceDir: options.workspaceDir,
      appServerConfig: options.appServerConfig
    });
    runState.resultOverrides = {
      threadId: turnResult.threadId,
      goal: turnResult.goal,
      goalObserved: turnResult.goalObserved,
      gitFingerprintBefore: runState.gitFingerprintBefore,
      gitFingerprintAfter: await computeGitFingerprint(orchestrator.exec, options.cwd)
    };
    await finalize(turnResult.code, null);
    processInfo.shutdown.stop('SIGTERM');
  } catch (error) {
    if (!runState.stopRequested) {
      tracker.onStderr(Buffer.from(`\n${error?.message || 'Codex app-server run failed.'}`));
    }
    runState.resultOverrides = {
      gitFingerprintBefore: runState.gitFingerprintBefore,
      gitFingerprintAfter: await computeGitFingerprint(orchestrator.exec, options.cwd).catch(() => null)
    };
    await finalize(1, null);
    processInfo.shutdown.stop('SIGTERM');
  }
}

function attachStartRunMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRun = function startCodexRun(options) {
    const streams = createRunStreams(this, options.taskId, options.runLabel);
    const processInfo = createRunProcess(this, options);
    const runState = {
      child: processInfo.child,
      stopRequested: false,
      stopTimeout: null,
      useProcessGroup: processInfo.useProcessGroup
    };
    this.running.set(options.taskId, runState);
    const finalize = createFinalizeRun(this, options, streams, runState);
    processInfo.child.on('error', (error) => {
      streams.tracker.onStderr(Buffer.from(`\n${error?.message || 'Unknown error'}`));
      finalize(1, null).catch(() => {});
    });
    processInfo.child.on('close', (code, signal) => {
      finalize(code, signal).catch(() => {});
    });
    void runCodexTurn({
      orchestrator: this,
      options,
      processInfo,
      tracker: streams.tracker,
      finalize,
      runState
    });
  };
}

module.exports = {
  attachStartRunMethod
};
