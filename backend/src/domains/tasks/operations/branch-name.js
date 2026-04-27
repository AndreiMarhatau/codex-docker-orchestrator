const { runStructuredCodex } = require('../../../shared/codex/structured-output');
const { createStoppedDuringStartupError } = require('./deferred-run-state');

const BRANCH_NAME_RETRY_LIMIT = 3;
const BRANCH_SCHEMA = {
  type: 'object',
  properties: {
    branchName: { type: 'string' }
  },
  required: ['branchName'],
  additionalProperties: false
};

function fallbackBranchName(taskId) {
  return `codex/${String(taskId).slice(0, 8)}`;
}

function normalizeBranchName(value) {
  return String(value || '').trim();
}

function buildBranchPrompt({ userPrompt, previousFailure }) {
  const parts = [
    'Generate one git branch name for this task.',
    'Requirements:',
    '- Return JSON with exactly one field: branchName.',
    '- The branch must start with codex/.',
    '- Use a short, descriptive, lowercase slug based on the user request.',
    '- Use only letters, numbers, slash, dash, underscore, and dot.',
    '- Keep it at most 72 characters.',
    '',
    `User request:\n${userPrompt}`
  ];
  if (previousFailure) {
    parts.push(
      '',
      `The previous branch name \`${previousFailure.branchName}\` was rejected: ${previousFailure.reason}. Generate a different valid branch.`
    );
  }
  return parts.join('\n');
}

function throwIfTaskStopRequested(orchestrator, taskId) {
  if (orchestrator.getTaskRunTransitionClaim?.(taskId)?.stopRequested) {
    throw createStoppedDuringStartupError();
  }
}

async function branchExistsOnRemote(exec, worktreePath, branchName) {
  const result = await exec('git', ['-C', worktreePath, 'ls-remote', '--heads', 'origin', branchName]);
  if (result.code !== 0) {
    return false;
  }
  return result.stdout.trim().length > 0;
}

async function validateBranchName(exec, worktreePath, branchName) {
  const name = normalizeBranchName(branchName);
  if (!name) {
    return { valid: false, reason: 'branch name is empty' };
  }
  if (!name.startsWith('codex/')) {
    return { valid: false, reason: 'branch name must start with codex/' };
  }
  if (name.length > 72) {
    return { valid: false, reason: 'branch name is longer than 72 characters' };
  }
  if (!/^[a-z0-9._/-]+$/.test(name)) {
    return { valid: false, reason: 'branch name contains unsupported characters' };
  }
  const formatResult = await exec('git', ['-C', worktreePath, 'check-ref-format', '--branch', name]);
  if (formatResult.code !== 0) {
    return {
      valid: false,
      reason: (formatResult.stderr || formatResult.stdout || 'git rejected the branch name').trim()
    };
  }
  const localResult = await exec('git', [
    '-C',
    worktreePath,
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${name}`
  ]);
  if (localResult.code === 0) {
    return { valid: false, reason: 'branch already exists locally' };
  }
  if (await branchExistsOnRemote(exec, worktreePath, name)) {
    return { valid: false, reason: 'branch already exists on origin' };
  }
  return { valid: true, branchName: name };
}

function attachBranchNameMethods(Orchestrator) {
  Orchestrator.prototype.generateTaskBranchName = async function generateTaskBranchName({
    taskId,
    prompt,
    cwd,
    workspaceDir,
    volumeMounts,
    envOverrides,
    artifactsDir,
    model,
    reasoningEffort
  }) {
    let previousFailure = null;
    for (let attempt = 0; attempt < BRANCH_NAME_RETRY_LIMIT; attempt += 1) {
      let output = null;
      throwIfTaskStopRequested(this, taskId);
      try {
        output = await runStructuredCodex({
          orchestrator: this,
          taskId,
          cwd,
          workspaceDir,
          volumeMounts,
          envOverrides,
          artifactsDir,
          prompt: buildBranchPrompt({ userPrompt: prompt, previousFailure }),
          model,
          reasoningEffort,
          developerInstructions: '',
          outputSchema: BRANCH_SCHEMA
        });
      } catch (error) {
        throwIfTaskStopRequested(this, taskId);
        previousFailure = {
          branchName: previousFailure?.branchName || '(none)',
          reason: error.message || 'branch generation failed'
        };
        continue;
      }
      throwIfTaskStopRequested(this, taskId);
      const branchName = normalizeBranchName(output.branchName);
      const validation = await validateBranchName(this.exec, cwd, branchName);
      if (validation.valid) {
        return validation.branchName;
      }
      previousFailure = {
        branchName: branchName || '(empty)',
        reason: validation.reason
      };
    }
    return fallbackBranchName(taskId);
  };
}

module.exports = {
  attachBranchNameMethods,
  buildBranchPrompt,
  fallbackBranchName,
  validateBranchName
};
