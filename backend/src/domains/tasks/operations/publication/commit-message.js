const { repoNameFromUrl } = require('../../../../orchestrator/utils');
const { runStructuredCodex } = require('../../../../shared/codex/structured-output');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('../mounts');

const COMMIT_MESSAGE_RETRY_LIMIT = 3;
const COMMIT_MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' }
  },
  required: ['message'],
  additionalProperties: false
};

async function readStagedChangeSummary(orchestrator, meta) {
  const statusResult = await orchestrator.execOrThrow('git', [
    '-C',
    meta.worktreePath,
    'status',
    '--short'
  ]);
  const statResult = await orchestrator.exec('git', [
    '-C',
    meta.worktreePath,
    'diff',
    '--cached',
    '--no-color',
    '--stat'
  ]);
  const diffResult = await orchestrator.exec('git', [
    '-C',
    meta.worktreePath,
    'diff',
    '--cached',
    '--no-color'
  ]);
  return {
    status: statusResult.stdout || '(empty)',
    stat: statResult.stdout || '(empty)',
    diff: (diffResult.stdout || '').slice(0, 20_000) || '(empty)'
  };
}

async function buildCommitMessageVolumeMounts(orchestrator, options) {
  const attachments = Array.isArray(options.meta.attachments) ? options.meta.attachments : [];
  const contextRepos = Array.isArray(options.meta.contextRepos) ? options.meta.contextRepos : [];
  return buildTaskRunVolumeMounts(orchestrator, {
    worktreePath: options.meta.worktreePath,
    workspaceDir: options.workspaceDir,
    mirrorPath: options.env.mirrorPath,
    attachmentsDir: orchestrator.taskAttachmentsDir(options.taskId),
    hasAttachments: attachments.length > 0,
    contextRepos,
    dockerSocketDir: orchestrator.taskDockerSocketDir(options.taskId),
    useHostDockerSocket: Boolean(options.meta.useHostDockerSocket)
  });
}

function buildCommitMessagePrompt(summary, previousFailure) {
  return [
    'Generate one concise git commit message subject for the staged changes.',
    'Requirements:',
    '- Return JSON with exactly one field: message.',
    '- Use imperative mood.',
    '- Keep it non-empty and at most 100 characters.',
    '- Do not include quotes, markdown, bullets, body text, or a trailing period.',
    previousFailure
      ? `The previous message \`${previousFailure.message}\` was rejected: ${previousFailure.reason}.`
      : '',
    '',
    `Git status:\n${summary.status}`,
    '',
    `Diff stat:\n${summary.stat}`,
    '',
    `Diff excerpt:\n${summary.diff}`
  ].filter(Boolean).join('\n');
}

function validateCommitMessage(message) {
  if (message && message.length <= 100 && !/[\r\n]/.test(message)) {
    return { valid: true, message: message.replace(/\.$/, '') };
  }
  return {
    valid: false,
    failure: {
      message: message || '(empty)',
      reason: !message ? 'message is empty' : 'message must be a single line under 100 characters'
    }
  };
}

async function generateCommitMessageAttempt(orchestrator, options, prompt) {
  return runStructuredCodex({
    orchestrator,
    taskId: options.taskId,
    cwd: options.meta.worktreePath,
    workspaceDir: options.workspaceDir,
    volumeMounts: options.volumeMounts,
    envOverrides: buildTaskRunEnvOverrides(
      options.env.envVars,
      Boolean(options.meta.useHostDockerSocket)
    ),
    artifactsDir: orchestrator.runArtifactsDir(
      options.taskId,
      options.meta.runs?.[options.meta.runs.length - 1]?.runId || 'run-1'
    ),
    prompt,
    model: options.meta.model || undefined,
    reasoningEffort: options.meta.reasoningEffort || undefined,
    developerInstructions: '',
    outputSchema: COMMIT_MESSAGE_SCHEMA
  });
}

function attachGenerateCommitMessageMethod(Orchestrator) {
  Orchestrator.prototype.generateCommitMessage = async function generateCommitMessage(
    taskId,
    meta,
    env
  ) {
    const summary = await readStagedChangeSummary(this, meta);
    const workspaceDir = `/workspace/${repoNameFromUrl(meta.repoUrl)}`;
    const volumeMounts = await buildCommitMessageVolumeMounts(this, {
      taskId,
      meta,
      env,
      workspaceDir
    });
    let previousFailure = null;
    for (let attempt = 0; attempt < COMMIT_MESSAGE_RETRY_LIMIT; attempt += 1) {
      const output = await generateCommitMessageAttempt(this, {
        taskId,
        meta,
        env,
        workspaceDir,
        volumeMounts
      }, buildCommitMessagePrompt(summary, previousFailure));
      const validation = validateCommitMessage(String(output.message || '').trim());
      if (validation.valid) {
        return validation.message;
      }
      previousFailure = validation.failure;
    }
    return `Update task ${String(taskId).slice(0, 8)}`;
  };
}

module.exports = {
  attachGenerateCommitMessageMethod
};
