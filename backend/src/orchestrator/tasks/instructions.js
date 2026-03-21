const fs = require('node:fs');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');
const { readConfigDeveloperInstructions } = require('./instructions-config');

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
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Orchestrator instructions path is not a file: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (error) {
    if (error?.message?.startsWith('Orchestrator instructions path is not a file:')) {
      throw error;
    }
    if (error?.code === 'ENOENT') {
      throw new Error(`Orchestrator instructions file not found: ${filePath}`);
    }
    throw new Error(
      `Failed to read orchestrator instructions file at ${filePath}: ${error?.message || 'Unknown error'}`
    );
  }
}

function readTopLevelDeveloperInstructions(codexHome) {
  return readConfigDeveloperInstructions({ codexHome, cwd: null });
}

function readEffectiveDeveloperInstructions(options) {
  return readConfigDeveloperInstructions(options);
}

function mergeDeveloperInstructions(userInstructions, orchestratorInstructions) {
  const sections = [userInstructions, orchestratorInstructions]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  if (sections.length === 0) {
    return null;
  }
  return `${sections.join('\n\n')}\n`;
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
  buildDeveloperInstructions,
  mergeDeveloperInstructions,
  readEffectiveDeveloperInstructions,
  readTopLevelDeveloperInstructions
};
