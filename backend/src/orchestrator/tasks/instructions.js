const {
  DEFAULT_CONTEXT_REPOS_TEMPLATE_FILE,
  DEFAULT_ATTACHMENTS_TEMPLATE_FILE,
  DEFAULT_INNER_ARTIFACTS_DIR
} = require('../constants');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');

function buildStaticInstructions() {
  return [
    'You are running inside an ephemeral Docker container with unrestricted access to the container filesystem and process environment.',
    '',
    '- The container is disposable. You are expected to do whatever is necessary to complete the work and verify results: install any tool, dependency, or system package; run any command, service, server, build, test, installer, long-running process; and take any other action you need, without asking the user for approval first.',
    '- Prefer keeping temporary downloads, caches, and generated artifacts outside the repository when practical.'
  ].join('\n').trim();
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
  useHostDockerSocket,
  contextRepos,
  attachments,
  exposedPaths
}) {
  const sections = [buildStaticInstructions()];
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
  for (const section of [
    dockerSection,
    contextSection,
    attachmentsSection,
    artifactsSection
  ]) {
    if (section) {
      sections.push(section.trimEnd());
    }
  }
  return `${sections.join('\n\n')}\n`;
}

function buildDeveloperInstructions(options) {
  return buildTaskInstructions.call(this, options);
}

function buildOrchestratorInstructions(options) {
  return buildTaskInstructions.call(this, options);
}

module.exports = {
  buildDeveloperInstructions,
  buildOrchestratorInstructions
};
