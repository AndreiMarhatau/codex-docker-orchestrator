const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { ensureDir } = require('../../storage');
const { invalidImageError, invalidContextError } = require('../errors');
const { normalizeOptionalString } = require('../utils');
const { resolveRefInRepo } = require('../git');
const { buildAttachmentsSection, buildContextReposSection } = require('../context');

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
  baseFile,
  hostDockerFile
}) {
  const contextSection = buildContextReposSection(contextRepos);
  const attachmentsSection = buildAttachmentsSection(attachments);
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
  if (sections.length === 0) {
    return null;
  }
  const combined = `${sections.join('\n\n')}\n`;
  const targetPath = path.join(this.taskLogsDir(taskId), `${runLabel}.agents.md`);
  fs.writeFileSync(targetPath, combined, 'utf8');
  return targetPath;
}

function attachTaskContextMethods(Orchestrator) {
  Orchestrator.prototype.resolveImagePaths = async function resolveImagePaths(imagePaths) {
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
  };

  Orchestrator.prototype.resolveContextRepos = async function resolveContextRepos(
    taskId,
    contextRepos
  ) {
    if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
      return [];
    }
    await ensureDir(this.taskContextDir(taskId));
    const seenEnvIds = new Set();
    const resolved = [];
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
      await this.execOrThrow('git', [
        '--git-dir',
        env.mirrorPath,
        'worktree',
        'add',
        '--detach',
        worktreePath,
        worktreeRef
      ]);
      resolved.push({
        envId,
        repoUrl: env.repoUrl,
        ref: targetRef,
        baseSha,
        worktreePath
      });
    }
    return resolved;
  };

  Orchestrator.prototype.buildAgentsAppendFile = function buildAgentsAppendFile({
    taskId,
    runLabel,
    useHostDockerSocket,
    contextRepos,
    attachments
  }) {
    const baseFile =
      this.orchAgentsFile && fs.existsSync(this.orchAgentsFile) ? this.orchAgentsFile : null;
    const hostDockerFile =
      this.hostDockerAgentsFile && fs.existsSync(this.hostDockerAgentsFile)
        ? this.hostDockerAgentsFile
        : null;
    const contextSection = buildContextReposSection(contextRepos);
    const attachmentsSection = buildAttachmentsSection(attachments);
    const shouldCombine = Boolean(useHostDockerSocket || contextSection || attachmentsSection);
    if (!shouldCombine) {
      return baseFile;
    }
    const includeHostDocker = Boolean(useHostDockerSocket && hostDockerFile);
    const agentsFile = buildAgentsFile.call(this, {
      taskId,
      runLabel,
      contextRepos,
      attachments,
      baseFile,
      hostDockerFile: includeHostDocker ? hostDockerFile : null
    });
    return agentsFile;
  };
}

module.exports = {
  attachTaskContextMethods
};
