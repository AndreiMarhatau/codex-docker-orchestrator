const fs = require('node:fs');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');

const HOST_DOCKER_SECTION = [
  '# Host Docker Socket',
  '',
  '- Docker is enabled for this task via an isolated per-task Docker sidecar daemon.',
  '- Docker commands can manage only resources created inside this task\'s sidecar daemon.',
  '- Host Docker resources and other tasks\' Docker resources are not reachable from this task.',
  '- You may use Docker commands as needed to complete the task.',
  '- Operate freely within this task\'s sidecar environment and clean up resources created during your work before finishing.'
].join('\n');

function buildEnvVarsSection(envVars) {
  if (!envVars || typeof envVars !== 'object') {
    return '';
  }
  const keys = Object.keys(envVars).filter(Boolean).sort();
  if (keys.length === 0) {
    return '';
  }
  const lines = keys.map((key) => `- \`${key}\``);
  return `## Environment variables\nThese variables are passed into the Codex container:\n${lines.join('\n')}`;
}

function readInstructionsFile(filePath) {
  if (!filePath) {
    return '';
  }
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (error) {
    // Best-effort: if the file cannot be read, continue without it.
  }
  return '';
}

function buildDeveloperInstructions({
  useHostDockerSocket,
  contextRepos,
  attachments,
  envVars,
  exposedPaths
}) {
  const contextEntries = exposedPaths?.contextRepos || contextRepos;
  const sections = [];
  const baseInstructions = readInstructionsFile(this.orchInstructionsFile);
  if (baseInstructions) {
    sections.push(baseInstructions);
  }
  if (useHostDockerSocket) {
    sections.push(HOST_DOCKER_SECTION);
  }
  const contextSection = buildContextReposSection(contextEntries, {
    repositoriesPath: exposedPaths?.repositoriesPath,
    repositoriesAliasPath: exposedPaths?.repositoriesAliasPath,
    templatePath: this.contextReposTemplateFile
  });
  if (contextSection) {
    sections.push(contextSection);
  }
  const attachmentsSection = buildAttachmentsSection(attachments, {
    uploadsPath: exposedPaths?.uploadsPath,
    templatePath: this.attachmentsTemplateFile
  });
  if (attachmentsSection) {
    sections.push(attachmentsSection);
  }
  const envVarsSection = buildEnvVarsSection(envVars);
  if (envVarsSection) {
    sections.push(envVarsSection);
  }
  if (sections.length === 0) {
    return null;
  }
  return `${sections.join('\n\n')}\n`;
}

module.exports = {
  buildDeveloperInstructions
};
