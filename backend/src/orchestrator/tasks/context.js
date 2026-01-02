const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { ensureDir } = require('../../storage');
const { invalidImageError, invalidContextError } = require('../errors');
const { normalizeOptionalString } = require('../utils');
const { resolveRefInRepo } = require('../git');
const { buildSkillFile, cleanupOrchestratorSkills } = require('./skills');

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

  Orchestrator.prototype.buildRunSkill = function buildRunSkill({
    taskId,
    runLabel,
    useHostDockerSocket,
    contextRepos
  }) {
    const skillTemplate =
      this.orchSkillTemplate && fs.existsSync(this.orchSkillTemplate)
        ? this.orchSkillTemplate
        : null;
    const hostDockerFile =
      this.hostDockerSkillFile && fs.existsSync(this.hostDockerSkillFile)
        ? this.hostDockerSkillFile
        : null;
    cleanupOrchestratorSkills(this.codexHome);
    const skillPath = buildSkillFile({
      codexHome: this.codexHome,
      taskId,
      runLabel,
      skillTemplate,
      hostDockerFile,
      contextRepos,
      useHostDockerSocket
    });
    if (skillPath) {
      const logCopy = path.join(this.taskLogsDir(taskId), `${runLabel}.skill.md`);
      try {
        fs.copyFileSync(skillPath, logCopy);
      } catch (error) {
        // Best-effort: logs should not block runs.
      }
    }
    return skillPath;
  };

  Orchestrator.prototype.cleanupRunSkill = function cleanupRunSkill(skillPath) {
    if (!skillPath) {
      return;
    }
    const skillDir = path.dirname(skillPath);
    if (!skillDir.startsWith(this.codexHome)) {
      return;
    }
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
    } catch (error) {
      // Best-effort: stale skills should not block cleanup.
    }
  };
}

module.exports = {
  attachTaskContextMethods
};
