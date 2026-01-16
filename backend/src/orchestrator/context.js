function buildContextReposSection(contextRepos) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
    return '';
  }
  const lines = [
    '# Read-only reference repositories',
    '',
    'The following repositories are mounted read-only for context:',
    ...contextRepos.map((repo) => {
      const repoLabel = repo.repoUrl || repo.envId || 'unknown';
      const refLabel = repo.ref ? ` (${repo.ref})` : '';
      return `- ${repoLabel}${refLabel} at ${repo.worktreePath}`;
    }),
    '',
    'Do not modify these paths; treat them as read-only references.'
  ];
  return lines.join('\n');
}

function buildRepoReadOnlySection({ repoReadOnly, worktreePath }) {
  if (!repoReadOnly) {
    return '';
  }
  const lines = [
    '# Task repository (read-only)',
    '',
    'The task repository is mounted read-only.',
    worktreePath ? `Path: ${worktreePath}` : null,
    '',
    'Do not modify this repository; treat it as read-only.'
  ].filter(Boolean);
  return lines.join('\n');
}

function buildAttachmentsSection(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }
  const lines = [
    '# User-uploaded files',
    '',
    'The following files were uploaded for this task:',
    ...attachments.map((file) => {
      const label = file?.name || file?.originalName || 'unknown';
      const pathLabel = file?.path || 'unknown';
      return `- ${label} at ${pathLabel}`;
    }),
    '',
    'These files persist across runs. Do not modify them directly; copy them into the repo if needed.'
  ];
  return lines.join('\n');
}

function buildCodexArgs({ prompt, model, reasoningEffort, imageArgs = [], resumeThreadId }) {
  const args = ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json'];
  if (model) {
    args.push('--model', model);
  }
  if (reasoningEffort) {
    args.push('-c', `model_reasoning_effort=${reasoningEffort}`);
  }
  if (resumeThreadId) {
    args.push('resume', resumeThreadId, prompt);
    return args;
  }
  args.push(...imageArgs, prompt);
  return args;
}

module.exports = {
  buildAttachmentsSection,
  buildContextReposSection,
  buildRepoReadOnlySection,
  buildCodexArgs
};
