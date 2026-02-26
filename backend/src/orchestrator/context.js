const fs = require('node:fs');

function resolveTemplate(templatePath, fallback) {
  if (!templatePath) {
    return fallback;
  }
  try {
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf8').trimEnd();
    }
  } catch (error) {
    // Best-effort: fall back to the default text.
  }
  return fallback;
}

function renderTemplate(template, data) {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key];
    }
    return '';
  });
}

function buildContextReposSection(contextRepos, options = {}) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
    return '';
  }
  const repositoriesPath = options.repositoriesPath || 'unknown';
  const list = contextRepos.map((repo) => {
    const repoLabel = repo?.repoUrl || repo?.envId || 'unknown';
    const refLabel = repo?.ref ? ` (${repo.ref})` : '';
    const aliasName = repo?.aliasName || repo?.name || null;
    const pathLabel =
      aliasName && repositoriesPath
        ? `${repositoriesPath}/${aliasName}`
        : repo?.worktreePath || 'unknown';
    return `- ${repoLabel}${refLabel} at ${pathLabel}`;
  });
  const defaultTemplate = [
    '# Read-only reference repositories',
    '',
    'The following repositories are mounted read-only for context at `{{repositoriesPath}}`:',
    '',
    '{{contextReposList}}',
    '',
    'Do not modify these paths; treat them as read-only references.'
  ].join('\n');
  const template = resolveTemplate(options.templatePath, defaultTemplate);
  return renderTemplate(template, {
    repositoriesPath,
    repositoriesAliasPath: options.repositoriesAliasPath || '',
    contextReposList: list.join('\n')
  }).trim();
}

function buildAttachmentsSection(attachments, options = {}) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }
  const uploadsPath = options.uploadsPath || 'unknown';
  const list = attachments.map((file) => {
    const label = file?.name || file?.originalName || 'unknown';
    const pathLabel =
      uploadsPath && label !== 'unknown' ? `${uploadsPath}/${label}` : file?.path || 'unknown';
    return `- ${label} at ${pathLabel}`;
  });
  const defaultTemplate = [
    '# User-uploaded files',
    '',
    'The following files were uploaded for this task and are available at `{{uploadsPath}}`:',
    '',
    '{{attachmentsList}}',
    '',
    'These files persist across runs. Do not modify them directly; copy them into the repo if needed.'
  ].join('\n');
  const template = resolveTemplate(options.templatePath, defaultTemplate);
  return renderTemplate(template, {
    uploadsPath,
    attachmentsList: list.join('\n')
  }).trim();
}

function buildCodexArgs({ prompt, model, reasoningEffort, resumeThreadId }) {
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
  args.push(prompt);
  return args;
}

module.exports = {
  buildAttachmentsSection,
  buildContextReposSection,
  buildCodexArgs
};
