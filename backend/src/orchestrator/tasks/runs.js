const fs = require('node:fs');
const path = require('node:path');
const { buildRunEnv, createOutputTracker, updateRunMeta } = require('./run-helpers');

function attachTaskRunMethods(Orchestrator) {
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
    } catch (error) {
      // Best-effort: keep task finalization resilient to auth sync issues.
    }
    await this.maybeAutoRotate(taskId, prompt, { ...result, usageLimit, meta });
  };

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
    exposedPaths
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
      logStream.end();
      stderrStream.end();
      if (runState.stopTimeout) {
        clearTimeout(runState.stopTimeout);
      }
      this.running.delete(taskId);
      const result = tracker.getResult();
      result.code = code ?? 1;
      result.stopped = runState.stopRequested || signal === 'SIGTERM' || signal === 'SIGKILL';
      await this.finalizeRun(taskId, runLabel, result, prompt);
    };

    child.on('error', (error) => {
      tracker.onStderr(Buffer.from(`\n${error?.message || 'Unknown error'}`));
      finalize(1, null).catch(() => {});
    });

    child.on('close', (code, signal) => {
      finalize(code, signal).catch(() => {});
    });
  };
}

module.exports = {
  attachTaskRunMethods
};
