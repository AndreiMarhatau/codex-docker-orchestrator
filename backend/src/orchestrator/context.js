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
  buildContextReposSection,
  buildCodexArgs
};
