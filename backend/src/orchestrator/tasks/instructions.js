const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_CONTEXT_REPOS_TEMPLATE_FILE,
  DEFAULT_ATTACHMENTS_TEMPLATE_FILE,
  DEFAULT_INNER_ARTIFACTS_DIR
} = require('../constants');
const { DEVELOPER_AGENT_INSTRUCTIONS } = require('../agent-instructions');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');

const ORCHESTRATOR_INSTRUCTIONS_PATH = path.resolve(
  __dirname,
  '../../../../ORCHESTRATOR_DEVELOPER_INSTRUCTIONS.md'
);

function buildStaticInstructions(baseInstructions) {
  return [
    'You are running inside an ephemeral Docker container with unrestricted access to the container filesystem and process environment.',
    '',
    '- The container is disposable. You are expected to do whatever is necessary to complete the work and verify results: install any tool, dependency, or system package; run any command, service, server, build, test, installer, or long-running process; and take any other action you need, without asking for approval first.',
    '- Prefer keeping temporary downloads, caches, and generated artifacts outside the repository when practical.',
    '',
    baseInstructions
  ].join('\n').trim();
}

function readUserInstructions(codexHome) {
  if (!codexHome) {
    return '';
  }
  const configPath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(configPath)) {
    return '';
  }

  let content = '';
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch {
    return '';
  }

  const multilineBasic = content.match(/^\s*developer_instructions\s*=\s*"""([\s\S]*?)"""\s*$/m);
  if (multilineBasic?.[1]) {
    return multilineBasic[1].trim();
  }

  const multilineLiteral = content.match(/^\s*developer_instructions\s*=\s*'''([\s\S]*?)'''\s*$/m);
  if (multilineLiteral?.[1]) {
    return multilineLiteral[1].trim();
  }

  const basic = content.match(/^\s*developer_instructions\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/m);
  if (basic?.[1]) {
    try {
      return JSON.parse(`"${basic[1]}"`).trim();
    } catch {
      return '';
    }
  }

  const literal = content.match(/^\s*developer_instructions\s*=\s*'([^']*)'\s*$/m);
  if (literal?.[1]) {
    return literal[1].trim();
  }

  return '';
}

function readOrchestratorInstructions() {
  return fs.readFileSync(ORCHESTRATOR_INSTRUCTIONS_PATH, 'utf8').trim();
}

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

function buildDockerSection(useHostDockerSocket) {
  if (useHostDockerSocket) {
    return [
      '## Docker availability',
      '- Docker is enabled for this task via an isolated per-task Docker sidecar daemon.',
      '- Docker commands can manage only resources created inside this task\'s sidecar daemon.',
      '- Host Docker resources and other tasks\' Docker resources are not reachable from this task.',
      '- You may use Docker commands as needed to complete the task.',
      '- Clean up resources created in this task\'s sidecar environment before finishing.'
    ].join('\n');
  }
  return [
    '## Docker availability',
    '- Docker is disabled for this task.',
    '- Do not assume Docker commands or a Docker daemon are available.'
  ].join('\n');
}

function buildArtifactsSection() {
  return [
    '## User-visible artifacts',
    `- If you need to save files for the user outside the repository, put them in \`${DEFAULT_INNER_ARTIFACTS_DIR}\`.`
  ].join('\n');
}

function buildTaskInstructions({
  baseInstructions,
  taskInstructionsLabel,
  useHostDockerSocket,
  contextRepos,
  attachments,
  envVars,
  exposedPaths
}) {
  const staticInstructions = buildStaticInstructions(baseInstructions);
  const userInstructions = readUserInstructions(this.codexHome);
  const sections = [];
  if (userInstructions) {
    sections.push(userInstructions);
  }
  if (staticInstructions) {
    sections.push(staticInstructions);
  }
  const contextEntries = exposedPaths?.contextRepos || contextRepos;
  const contextSection = buildContextReposSection(contextEntries, {
    repositoriesPath: exposedPaths?.repositoriesPath,
    repositoriesAliasPath: exposedPaths?.repositoriesAliasPath,
    templatePath: DEFAULT_CONTEXT_REPOS_TEMPLATE_FILE
  });
  const attachmentsSection = buildAttachmentsSection(attachments, {
    uploadsPath: exposedPaths?.uploadsPath,
    templatePath: DEFAULT_ATTACHMENTS_TEMPLATE_FILE
  });
  const dockerSection = buildDockerSection(useHostDockerSocket);
  const artifactsSection = buildArtifactsSection();
  const envVarsSection = buildEnvVarsSection(envVars);
  for (const section of [
    dockerSection,
    contextSection,
    attachmentsSection,
    artifactsSection,
    envVarsSection
  ]) {
    if (section) {
      sections.push(section.trimEnd());
    }
  }
  if (sections.length === 0) {
    return '';
  }
  if (sections.length === 1) {
    return `${sections[0]}\n`;
  }
  const [firstSection, secondSection, ...remainingSections] = sections;
  const combined = [firstSection, secondSection].join(
    userInstructions ? `\n\n--- ${taskInstructionsLabel} ---\n\n` : '\n\n'
  );
  const tail = remainingSections.length === 0
    ? ''
    : `\n\n${remainingSections.join('\n\n')}`;
  return `${userInstructions ? `${combined}${tail}` : sections.join('\n\n')}\n`;
}

function buildDeveloperInstructions(options) {
  return buildTaskInstructions.call(this, {
    ...options,
    baseInstructions: DEVELOPER_AGENT_INSTRUCTIONS,
    taskInstructionsLabel: 'task-developer-instructions'
  });
}

function buildOrchestratorInstructions(options) {
  return buildTaskInstructions.call(this, {
    ...options,
    baseInstructions: readOrchestratorInstructions(),
    taskInstructionsLabel: 'task-orchestrator-instructions'
  });
}

module.exports = {
  buildDeveloperInstructions,
  buildOrchestratorInstructions
};
