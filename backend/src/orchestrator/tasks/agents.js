const path = require('node:path');
const fs = require('node:fs');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');

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

function buildAgentsFile({
  taskId,
  runLabel,
  contextRepos,
  attachments,
  envVars,
  exposedPaths,
  baseFile,
  hostDockerFile
}) {
  const contextEntries = exposedPaths?.contextRepos || contextRepos;
  const contextSection = buildContextReposSection(contextEntries, {
    repositoriesPath: exposedPaths?.repositoriesPath,
    repositoriesAliasPath: exposedPaths?.repositoriesAliasPath,
    templatePath: this.contextReposTemplateFile
  });
  const attachmentsSection = buildAttachmentsSection(attachments, {
    uploadsPath: exposedPaths?.uploadsPath,
    templatePath: this.attachmentsTemplateFile
  });
  const envVarsSection = buildEnvVarsSection(envVars);
  const sections = [];
  if (baseFile) {
    const baseContent = fs.readFileSync(baseFile, 'utf8').trimEnd();
    if (baseContent) {
      sections.push(baseContent);
    }
  }
  if (hostDockerFile) {
    const hostContent = fs.readFileSync(hostDockerFile, 'utf8').trimEnd();
    if (hostContent) {
      sections.push(hostContent);
    }
  }
  if (contextSection) {
    sections.push(contextSection.trimEnd());
  }
  if (attachmentsSection) {
    sections.push(attachmentsSection.trimEnd());
  }
  if (envVarsSection) {
    sections.push(envVarsSection.trimEnd());
  }
  if (sections.length === 0) {
    return null;
  }
  const combined = `${sections.join('\n\n')}\n`;
  const targetPath = path.join(this.taskLogsDir(taskId), `${runLabel}.agents.md`);
  fs.writeFileSync(targetPath, combined, 'utf8');
  return targetPath;
}

function buildAgentsAppendFile({
  taskId,
  runLabel,
  useHostDockerSocket,
  contextRepos,
  attachments,
  envVars,
  exposedPaths
}) {
  const baseFile =
    this.orchAgentsFile && fs.existsSync(this.orchAgentsFile) ? this.orchAgentsFile : null;
  const hostDockerFile =
    this.hostDockerAgentsFile && fs.existsSync(this.hostDockerAgentsFile)
      ? this.hostDockerAgentsFile
      : null;
  const contextEntries = exposedPaths?.contextRepos || contextRepos;
  const contextSection = buildContextReposSection(contextEntries, {
    repositoriesPath: exposedPaths?.repositoriesPath,
    repositoriesAliasPath: exposedPaths?.repositoriesAliasPath,
    templatePath: this.contextReposTemplateFile
  });
  const attachmentsSection = buildAttachmentsSection(attachments, {
    uploadsPath: exposedPaths?.uploadsPath,
    templatePath: this.attachmentsTemplateFile
  });
  const envVarsSection = buildEnvVarsSection(envVars);
  const shouldCombine = Boolean(
    useHostDockerSocket || contextSection || attachmentsSection || envVarsSection
  );
  if (!shouldCombine) {
    return baseFile;
  }
  const includeHostDocker = Boolean(useHostDockerSocket && hostDockerFile);
  const agentsFile = buildAgentsFile.call(this, {
    taskId,
    runLabel,
    contextRepos,
    attachments,
    envVars,
    exposedPaths,
    baseFile,
    hostDockerFile: includeHostDocker ? hostDockerFile : null
  });
  return agentsFile;
}

module.exports = {
  buildAgentsAppendFile
};
