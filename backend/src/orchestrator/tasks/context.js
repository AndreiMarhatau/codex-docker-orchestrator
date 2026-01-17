const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { ensureDir } = require('../../storage');
const { invalidImageError, invalidContextError } = require('../errors');
const { normalizeOptionalString } = require('../utils');
const { resolveRefInRepo } = require('../git');
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
async function resolveImagePath(uploadsRoot, imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.trim()) {
    throw invalidImageError('Invalid image path provided.');
  }
  const resolvedPath = path.resolve(imagePath);
  if (resolvedPath === uploadsRoot || !resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw invalidImageError('Images must be uploaded via orchestrator before use.');
  }
  let stat;
  try {
    stat = await fsp.stat(resolvedPath);
  } catch (error) {
    throw invalidImageError(`Image not found: ${imagePath}`);
  }
  if (!stat.isFile()) {
    throw invalidImageError(`Image not found: ${imagePath}`);
  }
  return resolvedPath;
}
function buildAgentsFile({
  taskId,
  runLabel,
  contextRepos,
  attachments,
  envVars,
  baseFile,
  hostDockerFile
}) {
  const contextSection = buildContextReposSection(contextRepos);
  const attachmentsSection = buildAttachmentsSection(attachments);
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
async function resolveImagePaths(imagePaths) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return [];
  }
  if (imagePaths.length > 5) {
    throw invalidImageError('Up to 5 images are supported per request.');
  }
  const uploadsRoot = path.resolve(this.uploadsDir());
  const resolved = [];
  for (const imagePath of imagePaths) {
    const resolvedPath = await resolveImagePath(uploadsRoot, imagePath);
    if (!resolved.includes(resolvedPath)) {
      resolved.push(resolvedPath);
    }
  }
  return resolved;
}
async function prepareContextRepos(taskId, contextRepos) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
    return [];
  }
  await ensureDir(this.taskContextDir(taskId));
  const seenEnvIds = new Set();
  const planned = [];
  for (const entry of contextRepos) {
    const envId = normalizeOptionalString(entry?.envId);
    if (!envId) {
      throw invalidContextError('Each context repo must include a valid envId.');
    }
    if (seenEnvIds.has(envId)) {
      continue;
    }
    seenEnvIds.add(envId);
    const ref = normalizeOptionalString(entry?.ref);
    const env = await this.readEnv(envId);
    await this.ensureOwnership(env.mirrorPath);
    await this.execOrThrow('git', [
      '--git-dir',
      env.mirrorPath,
      'fetch',
      'origin',
      '--prune',
      '+refs/heads/*:refs/remotes/origin/*'
    ]);
    const targetRef = ref || env.defaultBranch;
    const worktreeRef = await resolveRefInRepo(
      this.execOrThrow.bind(this),
      env.mirrorPath,
      targetRef
    );
    const baseShaResult = await this.execOrThrow('git', [
      '--git-dir',
      env.mirrorPath,
      'rev-parse',
      worktreeRef
    ]);
    const baseSha = baseShaResult.stdout.trim() || null;
    const worktreePath = this.taskContextWorktree(taskId, env.repoUrl, envId);
    planned.push({
      envId,
      repoUrl: env.repoUrl,
      ref: targetRef,
      baseSha,
      mirrorPath: env.mirrorPath,
      worktreePath,
      worktreeRef
    });
  }
  return planned;
}
async function materializeContextRepos(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    return [];
  }
  const resolved = [];
  for (const entry of plan) {
    await this.execOrThrow('git', [
      '--git-dir',
      entry.mirrorPath,
      'worktree',
      'add',
      '--detach',
      entry.worktreePath,
      entry.worktreeRef
    ]);
    resolved.push({
      envId: entry.envId,
      repoUrl: entry.repoUrl,
      ref: entry.ref,
      baseSha: entry.baseSha,
      worktreePath: entry.worktreePath
    });
  }
  return resolved;
}
async function resolveContextRepos(taskId, contextRepos) {
  const plan = await this.prepareContextRepos(taskId, contextRepos);
  return this.materializeContextRepos(plan);
}
function buildAgentsAppendFile({
  taskId,
  runLabel,
  useHostDockerSocket,
  contextRepos,
  attachments,
  envVars
}) {
  const baseFile =
    this.orchAgentsFile && fs.existsSync(this.orchAgentsFile) ? this.orchAgentsFile : null;
  const hostDockerFile =
    this.hostDockerAgentsFile && fs.existsSync(this.hostDockerAgentsFile)
      ? this.hostDockerAgentsFile
      : null;
  const contextSection = buildContextReposSection(contextRepos);
  const attachmentsSection = buildAttachmentsSection(attachments);
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
    baseFile,
    hostDockerFile: includeHostDocker ? hostDockerFile : null
  });
  return agentsFile;
}

function attachTaskContextMethods(Orchestrator) {
  Orchestrator.prototype.resolveImagePaths = resolveImagePaths;
  Orchestrator.prototype.prepareContextRepos = prepareContextRepos;
  Orchestrator.prototype.materializeContextRepos = materializeContextRepos;
  Orchestrator.prototype.resolveContextRepos = resolveContextRepos;
  Orchestrator.prototype.buildAgentsAppendFile = buildAgentsAppendFile;
}

module.exports = {
  attachTaskContextMethods
};
