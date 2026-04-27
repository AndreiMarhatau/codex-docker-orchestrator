/* eslint-disable max-lines */
const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJson } = require('../../storage');
const { buildCodexAppServerArgs } = require('../app-server-args');
const { buildRunEnv, createOutputTracker, updateRunMeta } = require('./run-helpers');
const { createDeferredRunState, createStoppedDuringStartupError, isAbortError } = require('./deferred-run-state');
const { runAppServerTurn } = require('./app-server-runner');
const { computeGitFingerprint } = require('./git-fingerprint');
const { createBoundedChildShutdown } = require('./process-shutdown');

function createTaskBusyError() {
  const error = new Error('Wait for the current run to finish before continuing this task.');
  error.code = 'TASK_BUSY';
  return error;
}

function beginTaskRunFinalization(orchestrator, taskId) {
  const finalizingTaskRuns = orchestrator.finalizingTaskRuns || new Map();
  orchestrator.finalizingTaskRuns = finalizingTaskRuns;
  const state = finalizingTaskRuns.get(taskId) || {
    count: 0,
    stopRequested: false,
    afterRelease: []
  };
  state.count += 1;
  finalizingTaskRuns.set(taskId, state);
  return () => {
    const activeState = finalizingTaskRuns.get(taskId);
    if (!activeState) {
      return;
    }
    activeState.count -= 1;
    if (activeState.count > 0) {
      return;
    }
    const callbacks = activeState.stopRequested ? [] : activeState.afterRelease || [];
    finalizingTaskRuns.delete(taskId);
    for (const callback of callbacks) {
      void Promise.resolve().then(callback).catch(() => {});
    }
  };
}

function claimTaskRunTransition(orchestrator, taskId) {
  const taskRunClaims = orchestrator.taskRunClaims || new Map();
  orchestrator.taskRunClaims = taskRunClaims;
  if (
    taskRunClaims.has(taskId) ||
    orchestrator.running.has(taskId) ||
    orchestrator.finalizingTaskRuns?.has(taskId)
  ) {
    throw createTaskBusyError();
  }
  const claim = {
    token: Symbol(taskId),
    stopRequested: false,
    runtimeActive: false,
    cancelCallbacks: new Set()
  };
  taskRunClaims.set(taskId, claim);
  const release = () => {
    if (taskRunClaims.get(taskId) === claim) {
      taskRunClaims.delete(taskId);
    }
  };
  release.claim = claim;
  return release;
}

function requestClaimStop(claim) {
  claim.stopRequested = true;
  for (const cancel of claim.cancelCallbacks || []) {
    try {
      cancel('SIGTERM');
    } catch {
      // Cancellation callbacks are best-effort; stop still updates task state.
    }
  }
}

async function resolveCurrentBranch(exec, worktreePath) {
  const result = await exec('git', ['-C', worktreePath, 'branch', '--show-current']);
  if (result.code !== 0) {
    return null;
  }
  const branchName = result.stdout.trim();
  return branchName || null;
}

async function syncTaskBranchFromWorktree(exec, taskMetaPath, taskId, worktreePath) {
  if (!worktreePath) {
    return;
  }
  const resolvedBranch = await resolveCurrentBranch(exec, worktreePath);
  if (!resolvedBranch) {
    return;
  }
  const meta = await readJson(taskMetaPath(taskId));
  if (meta.branchName === resolvedBranch) {
    return;
  }
  meta.branchName = resolvedBranch;
  await writeJson(taskMetaPath(taskId), meta);
}

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
        exitCode: 1,
        failedBeforeSpawn: stopped ? false : true
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    this.notifyTasksChanged(taskId);
  };
}
function attachDeferredRunStartMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRunDeferred = function startCodexRunDeferred(options) {
    const { taskId, runLabel, prompt, useHostDockerSocket, transitionClaim } = options;
    if (transitionClaim?.stopRequested) {
      void this.failRunStart(taskId, runLabel, prompt, createStoppedDuringStartupError());
      return;
    }
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
        const releaseFinalizing = beginTaskRunFinalization(this, taskId);
        if (pendingRun.stopTimeout) {
          clearTimeout(pendingRun.stopTimeout);
        }
        try {
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
        } finally {
          releaseFinalizing();
        }
      }
    })();
  };
}
function attachFinalizeRunMethod(Orchestrator) {
  Orchestrator.prototype.finalizeRun = async function finalizeRun(taskId, runLabel, result, prompt) {
    const isStopped = () =>
      result.stopped === true || this.getFinalizingTaskRun(taskId)?.stopRequested === true;
    if (isStopped()) {
      result.stopped = true;
    }
    const { meta, usageLimit } = await updateRunMeta({
      taskId,
      runLabel,
      result,
      prompt,
      now: this.now,
      taskMetaPath: this.taskMetaPath.bind(this),
      runArtifactsDir: this.runArtifactsDir.bind(this),
      isStopped
    });
    await syncTaskBranchFromWorktree(this.exec, this.taskMetaPath.bind(this), taskId, meta.worktreePath)
      .catch(() => {});
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
    if (
      !result.stopped &&
      result.code === 0 &&
      meta.autoReview === true &&
      Number(runEntry?.autoReviewRemaining || 0) > 0 &&
      runEntry?.gitFingerprintBefore &&
      runEntry?.gitFingerprintAfter &&
      runEntry.gitFingerprintBefore !== runEntry.gitFingerprintAfter
    ) {
      this.runAfterTaskFinalization(taskId, () => {
        void this.runAutoReviewForTask(taskId, runLabel).catch((error) => {
          void this.appendRunAgentMessage(taskId, runLabel, `Auto review failed: ${error.message}`)
            .catch(() => {});
          this.notifyTasksChanged(taskId);
        });
      });
    }
    this.notifyTasksChanged(taskId);
  };
}
function attachStartRunMethod(Orchestrator) {
  Orchestrator.prototype.startCodexRun = function startCodexRun({
    taskId,
    runLabel,
    prompt,
    codexPrompt,
    cwd,
    appServerConfig,
    workspaceDir,
    volumeMounts = [],
    envOverrides,
    stopTaskDockerSidecarOnExit = false
  }) {
    const logFile = `${runLabel}.jsonl`;
    const logPath = path.join(this.taskLogsDir(taskId), logFile);
    const stderrPath = path.join(this.taskLogsDir(taskId), `${runLabel}.stderr`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
    const artifactsDir = this.runArtifactsDir(taskId, runLabel);
    const env = buildRunEnv({
      orchestrator: this,
      workspaceDir,
      artifactsDir,
      volumeMounts,
      envOverrides
    });
    const useProcessGroup = process.platform !== 'win32';
    const child = this.spawn('codex-docker', buildCodexAppServerArgs(), {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: useProcessGroup
    });
    const shutdown = createBoundedChildShutdown({
      child,
      useProcessGroup,
      stopTimeoutMs: this.appServerShutdownTimeoutMs
    });
    const runState = { child, stopRequested: false, stopTimeout: null, useProcessGroup };
    this.running.set(taskId, runState);
    const tracker = createOutputTracker({ logStream, stderrStream });
    let finalized = false;
    const finalize = async (code, signal) => {
      if (finalized) {
        return;
      }
      finalized = true;
      const releaseFinalizing = beginTaskRunFinalization(this, taskId);
      if (runState.stopTimeout) {
        clearTimeout(runState.stopTimeout);
      }
      try {
        const activeRun = this.running.get(taskId);
        if (activeRun === runState) {
          this.running.delete(taskId);
        }
        const result = { ...tracker.getResult(), ...(runState.resultOverrides || {}) };
        result.code = code ?? 1;
        const isStopped = () =>
          runState.stopRequested ||
          this.getFinalizingTaskRun(taskId)?.stopRequested === true ||
          signal === 'SIGTERM' ||
          signal === 'SIGKILL';
        result.stopped = isStopped();
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
        releaseFinalizing();
      }
    };
    child.on('error', (error) => {
      tracker.onStderr(Buffer.from(`\n${error?.message || 'Unknown error'}`));
      finalize(1, null).catch(() => {});
    });
    child.on('close', (code, signal) => { finalize(code, signal).catch(() => {}); });
    void (async () => {
      try {
        runState.gitFingerprintBefore = await computeGitFingerprint(this.exec, cwd);
        const turnResult = await runAppServerTurn({
          child,
          tracker,
          prompt: codexPrompt ?? prompt,
          workspaceDir,
          appServerConfig
        });
        runState.resultOverrides = {
          threadId: turnResult.threadId,
          gitFingerprintBefore: runState.gitFingerprintBefore,
          gitFingerprintAfter: await computeGitFingerprint(this.exec, cwd)
        };
        await finalize(turnResult.code, null);
        shutdown.stop('SIGTERM');
      } catch (error) {
        if (!runState.stopRequested) {
          tracker.onStderr(Buffer.from(`\n${error?.message || 'Codex app-server run failed.'}`));
        }
        runState.resultOverrides = {
          gitFingerprintBefore: runState.gitFingerprintBefore,
          gitFingerprintAfter: await computeGitFingerprint(this.exec, cwd).catch(() => null)
        };
        await finalize(1, null);
        shutdown.stop('SIGTERM');
      }
    })();
  };
}
function attachTaskRunMethods(Orchestrator) {
  Orchestrator.prototype.claimTaskRunTransition = function claimTaskRunTransitionMethod(taskId) {
    return claimTaskRunTransition(this, taskId);
  };
  Orchestrator.prototype.getTaskRunTransitionClaim = function getTaskRunTransitionClaim(taskId) {
    return this.taskRunClaims?.get(taskId) || null;
  };
  Orchestrator.prototype.requestTaskRunTransitionStop = function requestTaskRunTransitionStop(
    taskId
  ) {
    const claim = this.getTaskRunTransitionClaim(taskId);
    if (!claim) {
      return false;
    }
    requestClaimStop(claim);
    return true;
  };
  Orchestrator.prototype.registerTaskRunTransitionCancel =
    function registerTaskRunTransitionCancel(taskId, cancel) {
      const claim = this.getTaskRunTransitionClaim(taskId);
      if (!claim || typeof cancel !== 'function') {
        return () => {};
      }
      claim.cancelCallbacks.add(cancel);
      if (claim.stopRequested) {
        try {
          cancel('SIGTERM');
        } catch {
          // Ignore immediate cancellation failures.
        }
      }
      return () => {
        claim.cancelCallbacks.delete(cancel);
      };
    };
  Orchestrator.prototype.markTaskRunTransitionRuntimeActive =
    function markTaskRunTransitionRuntimeActive(claim) {
      if (claim) {
        claim.runtimeActive = true;
      }
    };
  Orchestrator.prototype.getFinalizingTaskRun = function getFinalizingTaskRun(taskId) {
    return this.finalizingTaskRuns?.get(taskId) || null;
  };
  Orchestrator.prototype.runAfterTaskFinalization = function runAfterTaskFinalization(
    taskId,
    callback
  ) {
    const state = this.getFinalizingTaskRun(taskId);
    if (!state) {
      return false;
    }
    state.afterRelease.push(callback);
    return true;
  };
  Orchestrator.prototype.requestFinalizingTaskStop = function requestFinalizingTaskStop(taskId) {
    const state = this.getFinalizingTaskRun(taskId);
    if (!state) {
      return false;
    }
    state.stopRequested = true;
    return true;
  };
  attachFailRunStartMethod(Orchestrator); attachDeferredRunStartMethod(Orchestrator);
  attachFinalizeRunMethod(Orchestrator); attachStartRunMethod(Orchestrator);
}
module.exports = { attachTaskRunMethods };
