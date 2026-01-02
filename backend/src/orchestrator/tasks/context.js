const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { ensureDir } = require('../../storage');
const { invalidImageError, invalidContextError } = require('../errors');
const { normalizeOptionalString } = require('../utils');
const { resolveRefInRepo } = require('../git');
const { buildContextReposSection } = require('../context');

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

function createSkillId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1e9);
  return `${timestamp}-${random}`;
}

function renderSkillTemplate(templateContent, skillName) {
  const trimmed = templateContent.trimEnd();
  if (trimmed.includes('{{SKILL_NAME}}')) {
    return trimmed.replace(/{{SKILL_NAME}}/g, skillName);
  }
  const frontmatterMatch = trimmed.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const hasName = /^name:\s*.+$/m.test(frontmatter);
    const updatedFrontmatter = hasName
      ? frontmatter.replace(/^name:\s*.*$/m, `name: ${skillName}`)
      : `name: ${skillName}\n${frontmatter}`;
    return trimmed.replace(frontmatterMatch[1], updatedFrontmatter);
  }
  const header = [
    '---',
    `name: ${skillName}`,
    'description: Orchestrator guidance injected by codex-docker-orchestrator.',
    'metadata:',
    '  short-description: Codex orchestrator guidance',
    '---',
    ''
  ].join('\n');
  return `${header}${trimmed}`;
}

function cleanupOrchestratorSkills(codexHome) {
  const skillsDir = path.join(codexHome, 'skills');
  if (!fs.existsSync(skillsDir)) {
    return;
  }
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('codex-orchestrator-')) {
      continue;
    }
    const targetPath = path.join(skillsDir, entry.name);
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } catch (error) {
      // Best-effort: stale skills should not block runs.
    }
  }
}

function buildSkillFile({
  codexHome,
  skillTemplate,
  hostDockerFile,
  contextRepos,
  useHostDockerSocket
}) {
  const contextSection = buildContextReposSection(contextRepos);
  const sections = [];
  if (skillTemplate) {
    const baseContent = fs.readFileSync(skillTemplate, 'utf8').trimEnd();
    if (baseContent) {
      sections.push(baseContent);
    }
  }
  if (useHostDockerSocket && hostDockerFile) {
    const hostContent = fs.readFileSync(hostDockerFile, 'utf8').trimEnd();
    if (hostContent) {
      sections.push(hostContent);
    }
  }
  if (contextSection) {
    sections.push(contextSection.trimEnd());
  }
  if (sections.length === 0) {
    return null;
  }
  const skillId = createSkillId();
  const skillName = `codex-orchestrator-guidance-${skillId}`;
  const skillDir = path.join(codexHome, 'skills', `codex-orchestrator-${skillId}`);
  fs.mkdirSync(skillDir, { recursive: true });
  const combined = `${sections.join('\n\n')}\n`;
  const skillContent = renderSkillTemplate(combined, skillName);
  const skillPath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillPath, skillContent, 'utf8');
  return skillPath;
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
