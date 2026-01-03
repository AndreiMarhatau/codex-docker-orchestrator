import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { buildSkillFile, cleanupTaskSkill } = require('../../src/orchestrator/tasks/skills');

async function writeSkillTemplate(baseDir) {
  const templatePath = path.join(baseDir, 'skill-template.md');
  const content = [
    '---',
    'name: {{SKILL_NAME}}',
    'description: Test skill',
    '---',
    '',
    '# Skill body'
  ].join('\n');
  await fs.writeFile(templatePath, content, 'utf8');
  return templatePath;
}

describe('orchestrator skills', () => {
  it('uses a stable skill id derived from the task id', async () => {
    const codexHome = await createTempDir();
    const templatePath = await writeSkillTemplate(codexHome);
    const skillPath = buildSkillFile({
      codexHome,
      taskId: 'task/1',
      skillTemplate: templatePath,
      hostDockerFile: null,
      contextRepos: [],
      useHostDockerSocket: false
    });

    expect(skillPath).toContain(path.join('skills', 'codex-orchestrator-task-1', 'SKILL.md'));
    const skillContent = await fs.readFile(skillPath, 'utf8');
    expect(skillContent).toContain('name: codex-orchestrator-guidance-task-1');
  });

  it('falls back to a random id when task id is missing', async () => {
    const codexHome = await createTempDir();
    const templatePath = await writeSkillTemplate(codexHome);
    const skillPath = buildSkillFile({
      codexHome,
      taskId: '',
      skillTemplate: templatePath,
      hostDockerFile: null,
      contextRepos: [],
      useHostDockerSocket: false
    });

    expect(skillPath).toContain(path.join('skills', 'codex-orchestrator-'));
    const skillContent = await fs.readFile(skillPath, 'utf8');
    expect(skillContent).toContain('name: codex-orchestrator-guidance-');

    cleanupTaskSkill(codexHome, '');
    cleanupTaskSkill('', 'task-1');
  });
});
