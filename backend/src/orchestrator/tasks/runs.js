/* eslint-disable max-lines */
const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJson } = require('../../storage');
const { buildRunEnv, createOutputTracker, updateRunMeta } = require('./run-helpers');
const { createDeferredRunState, createStoppedDuringStartupError, isAbortError } = require('./deferred-run-state');

function attachFailRunStartMethod(Orchestrator) {
  Orchestrator.prototype.failRunStart = async function failRunStart(taskId, runLabel, prompt, error) {
    let meta = null;
    try {
      meta = await readJson(this.taskMetaPath(taskId));
    } catch (readError) {
      return;
    }
    const now = this.now();
    const stopped = error?.stopped === true;
    const message = stopped ? 'Stopped by user.' : error?.message || 'Failed to start Codex run.';
    meta.status = stopped ? 'stopped' : 'failed';
    meta.error = message;
    meta.updatedAt = now;
    meta.lastPrompt = prompt || meta.lastPrompt || null;
    const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
    if (runIndex !== -1) {
      meta.runs[runIndex] = {
        ...meta.runs[runIndex],
        finishedAt: now,
        status: stopped ? 'stopped' : 'failed',
        exitCode: 1
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    this.notifyTasksChanged(taskId);
  };
}
function attachDeferredRunStartMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRunDeferred = function startCodexRunDeferred(options) {
    const { taskId, runLabel, prompt, useHostDockerSocket } = options;
    const pendingRun = createDeferredRunState();
    pendingRun.startController = new AbortController();
    this.running.set(taskId, pendingRun);
    void (async () => {
      let hadExistingSidecar = null;
      try {
        if (useHostDockerSocket) {
          hadExistingSidecar = await this.taskDockerSidecarExists(taskId, {
            signal: pendingRun.startController.signal
          });
          await this.ensureTaskDockerSidecar(taskId, {
            signal: pendingRun.startController.signal
          });
        }
        if (pendingRun.stopRequested) {
          throw createStoppedDuringStartupError();
        }
        this.startCodexRun(options);
      } catch (error) {
        if (pendingRun.stopTimeout) {
          clearTimeout(pendingRun.stopTimeout);
        }
        const activeRun = this.running.get(taskId);
        if (activeRun === pendingRun) {
          this.running.delete(taskId);
        }
        if (useHostDockerSocket) {
          try {
            if (hadExistingSidecar !== false) {
              await this.stopTaskDockerSidecar(taskId);
            } else {
              await this.removeTaskDockerSidecar(taskId);
            }
          } catch {
            // Best-effort cleanup for sidecar startup failures.
          }
        }
        const startupError =
          pendingRun.stopRequested && isAbortError(error) ? createStoppedDuringStartupError() : error;
        try {
          await this.failRunStart(taskId, runLabel, prompt, startupError);
        } catch {
          // Never surface deferred bookkeeping failures as unhandled rejections.
        }
      }
    })();
  };
}
function attachFinalizeRunMethod(Orchestrator) {
  Orchestrator.prototype.finalizeRun = async function finalizeRun(taskId, runLabel, result, prompt) {
    const { meta, usageLimit } = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt,
      now: this.now,
      taskMetaPath: this.taskMetaPath.bind(this),
      runArtifactsDir: this.runArtifactsDir.bind(this)
    });
    const runEntry = meta.runs.find((run) => run.runId === runLabel);
    try {
      await this.accountStore.syncAccountFromHost(runEntry?.accountId || null);
      if (runEntry?.accountId) {
        this.notifyAccountsChanged(runEntry.accountId);
      }
    } catch (error) {
      // Best-effort: keep task finalization resilient to auth sync issues.
    }
    await this.maybeAutoRotate(taskId, prompt, { ...result, usageLimit, meta });
    this.notifyTasksChanged(taskId);
  };
}
function attachStartRunMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRun = function startCodexRun({
    taskId,
    runLabel,
    prompt,
    cwd,
    args,
    mountPaths = [],
    mountPathsRo = [],
    mountMaps = [],
    mountMapsRo = [],
    contextRepos = [],
    attachments = [],
    useHostDockerSocket,
    envOverrides,
    envVars,
    homeDir,
    exposedPaths,
    stopTaskDockerSidecarOnExit = false
  }) {
    const logFile = `${runLabel}.jsonl`;
    const logPath = path.join(this.taskLogsDir(taskId), logFile);
    const stderrPath = path.join(this.taskLogsDir(taskId), `${runLabel}.stderr`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
    const agentsAppendFile = this.buildAgentsAppendFile({
      taskId,
      runLabel,
      useHostDockerSocket,
      contextRepos,
      attachments,
      envVars,
      exposedPaths
    });
    const artifactsDir = this.runArtifactsDir(taskId, runLabel);
    const env = buildRunEnv({
      codexHome: this.codexHome,
      artifactsDir,
      mountPaths,
      mountPathsRo,
      mountMaps,
      mountMapsRo,
      agentsAppendFile,
      envOverrides,
      homeDir
    });
    const useProcessGroup = process.platform !== 'win32';
    const child = this.spawn('codex-docker', args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: useProcessGroup
    });
    if (child.stdin) {
      child.stdin.end();
    }
    const runState = { child, stopRequested: false, stopTimeout: null, useProcessGroup };
    this.running.set(taskId, runState);
    const tracker = createOutputTracker({ logStream, stderrStream });
    child.stdout.on('data', tracker.onStdout);
    child.stderr.on('data', tracker.onStderr);
    const finalize = async (code, signal) => {
      if (runState.stopTimeout) {
        clearTimeout(runState.stopTimeout);
      }
      this.running.delete(taskId);
      const result = tracker.getResult();
      result.code = code ?? 1;
      result.stopped = runState.stopRequested || signal === 'SIGTERM' || signal === 'SIGKILL';
      try {
        await this.finalizeRun(taskId, runLabel, result, prompt);
      } finally {
        let stopErrorMessage = null;
        if (stopTaskDockerSidecarOnExit && !this.running.has(taskId)) {
          try {
            await this.stopTaskDockerSidecar(taskId);
          } catch (error) {
            stopErrorMessage = `Failed to stop task Docker sidecar: ${error?.message || 'Unknown error'}`;
          }
        }
        if (stopErrorMessage) {
          tracker.onStderr(Buffer.from(`\n${stopErrorMessage}`));
        }
        logStream.end();
        stderrStream.end();
      }
    };
    child.on('error', (error) => {
      tracker.onStderr(Buffer.from(`\n${error?.message || 'Unknown error'}`));
      finalize(1, null).catch(() => {});
    });
    child.on('close', (code, signal) => { finalize(code, signal).catch(() => {}); });
  };
}
function attachTaskRunMethods(Orchestrator) {
  attachFailRunStartMethod(Orchestrator); attachDeferredRunStartMethod(Orchestrator);
  attachFinalizeRunMethod(Orchestrator); attachStartRunMethod(Orchestrator);
}
module.exports = { attachTaskRunMethods };
