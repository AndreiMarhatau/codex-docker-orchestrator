const { ensureDir, readJson, writeJson } = require('../../storage');
const { buildCodexArgs } = require('../context');
const { nextRunLabel, normalizeOptionalString } = require('../utils');
const { buildRunEntry } = require('./run-entry');
const { cleanupContextRepos } = require('./cleanup');

function attachTaskResumeMethods(Orchestrator) {
  Orchestrator.prototype.resumeTask = async function resumeTask(taskId, prompt, options = {}) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.threadId) {
      throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
    }
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
    const hasContextReposOverride = Object.prototype.hasOwnProperty.call(options, 'contextRepos');
    let resolvedContextRepos = contextRepos;
    if (hasContextReposOverride) {
      const contextPlan = await this.prepareContextRepos(taskId, options.contextRepos || []);
      await cleanupContextRepos(this, contextRepos);
      resolvedContextRepos = await this.materializeContextRepos(contextPlan);
      meta.contextRepos = resolvedContextRepos;
    }
    const hasDockerSocketOverride = typeof options.useHostDockerSocket === 'boolean';
    const shouldUseHostDockerSocket = hasDockerSocketOverride
      ? options.useHostDockerSocket
      : Boolean(meta.useHostDockerSocket);
    const dockerSocketPath = shouldUseHostDockerSocket ? this.requireDockerSocket() : null;
    const env = await this.readEnv(meta.envId);
    await this.ensureOwnership(env.mirrorPath);

    const exposedPaths = await this.prepareTaskExposedPaths(taskId, {
      contextRepos: resolvedContextRepos,
      attachments,
      codexHome: this.codexHome
    });

    const runLabel = nextRunLabel(meta.runs.length + 1);
    const hasPrompt = typeof prompt === 'string' && prompt.length > 0;
    const hasCodexPromptOverride = Object.prototype.hasOwnProperty.call(options, 'codexPrompt');
    const codexPrompt = hasCodexPromptOverride ? options.codexPrompt : prompt;
    meta.updatedAt = this.now();
    meta.status = 'running';
    if (hasPrompt) {
      meta.lastPrompt = prompt;
    }
    if (hasDockerSocketOverride) {
      meta.useHostDockerSocket = shouldUseHostDockerSocket;
    }
    const runModel = normalizeOptionalString(options.model) ?? normalizeOptionalString(meta.model);
    const runReasoningEffort =
      normalizeOptionalString(options.reasoningEffort) ??
      normalizeOptionalString(meta.reasoningEffort);
    const activeAccount = await this.accountStore.getActiveAccount();
    meta.runs.push(
      buildRunEntry({
        runLabel,
        prompt,
        model: runModel,
        reasoningEffort: runReasoningEffort,
        now: this.now(),
        account: activeAccount,
        useHostDockerSocket: shouldUseHostDockerSocket
      })
    );

    await ensureDir(this.runArtifactsDir(taskId, runLabel));
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.ensureActiveAuth();
    const args = buildCodexArgs({
      prompt: codexPrompt,
      model: runModel,
      reasoningEffort: runReasoningEffort,
      resumeThreadId: meta.threadId
    });
    const attachmentsDir = this.taskAttachmentsDir(taskId);
    const hasAttachments = attachments.length > 0;
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: meta.worktreePath,
      args,
      mountPaths: [exposedPaths.homeDir, env.mirrorPath, ...(dockerSocketPath ? [dockerSocketPath] : [])],
      mountPathsRo: [
        ...resolvedContextRepos.map((repo) => repo.worktreePath),
        ...(hasAttachments ? [attachmentsDir] : [])
      ],
      contextRepos: resolvedContextRepos,
      attachments,
      useHostDockerSocket: shouldUseHostDockerSocket,
      envOverrides: env.envVars,
      envVars: env.envVars,
      homeDir: exposedPaths.homeDir,
      exposedPaths
    });
    return meta;
  };

  Orchestrator.prototype.stopTask = async function stopTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const run = this.running.get(taskId);
    if (!run) {
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
    try {
      run.child.kill('SIGTERM');
      run.stopTimeout = setTimeout(() => {
        try {
          run.child.kill('SIGKILL');
        } catch (error) {
          // Ignore kill errors.
        }
      }, 5000);
    } catch (error) {
      // Ignore kill errors.
    }

    const updatedAt = this.now();
    meta.status = 'stopping';
    meta.updatedAt = updatedAt;
    if (meta.runs?.length) {
      meta.runs[meta.runs.length - 1] = {
        ...meta.runs[meta.runs.length - 1],
        status: 'stopping'
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    return meta;
  };
}

module.exports = {
  attachTaskResumeMethods
};
