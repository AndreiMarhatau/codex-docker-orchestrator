const fs = require('node:fs');
const path = require('node:path');
const { buildContextReposSection } = require('../context');

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
    'description: Runtime guidance injected by the orchestrator.',
    'metadata:',
    '  short-description: Orchestrator guidance',
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

function buildSkillFile({ codexHome, skillTemplate, hostDockerFile, contextRepos, useHostDockerSocket }) {
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

module.exports = {
  buildSkillFile,
  cleanupOrchestratorSkills
};
