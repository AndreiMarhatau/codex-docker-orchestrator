import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function extractDeveloperInstructions(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === '-c' || arg === '--config') && typeof args[index + 1] === 'string') {
      const value = args[index + 1];
      if (value.startsWith('developer_instructions=')) {
        return JSON.parse(value.slice('developer_instructions='.length));
      }
    }
    if (typeof arg === 'string' && arg.startsWith('--config=developer_instructions=')) {
      return JSON.parse(arg.slice('--config=developer_instructions='.length));
    }
  }
  return null;
}

describe('orchestrator developer instructions', () => {
  it('composes active-profile developer instructions with orchestrator instructions', async () => {
    const orchHome = await createTempDir();
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      [
        'profile = "team"',
        'developer_instructions = "Root fallback."',
        '',
        '[profiles.team]',
        'developer_instructions = """Keep responses terse."""'
      ].join('\n'),
      'utf8'
    );
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn
    });

    const primaryEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const contextEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context.git',
      defaultBranch: 'main'
    });

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnv.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    const developerInstructions = extractDeveloperInstructions(runCall.args);
    expect(developerInstructions).toContain('Keep responses terse.');
    expect(developerInstructions).not.toContain('Root fallback.');
    expect(developerInstructions).toContain('Read-only reference repositories');
  });
});
