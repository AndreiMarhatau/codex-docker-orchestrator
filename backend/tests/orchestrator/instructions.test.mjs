import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  buildDeveloperInstructions,
  buildOrchestratorInstructions
} = require('../../src/orchestrator/tasks/instructions');
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const ORCHESTRATOR_DEVELOPER_INSTRUCTIONS_FILE = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../../ORCHESTRATOR_DEVELOPER_INSTRUCTIONS.md'
);

function buildInstructionOptions(overrides = {}) {
  return {
    useHostDockerSocket: false,
    contextRepos: [],
    attachments: [],
    envVars: null,
    exposedPaths: {
      uploadsPath: '/attachments',
      repositoriesPath: '/readonly',
      repositoriesAliasPath: '/readonly',
      contextRepos: []
    },
    ...overrides
  };
}

describe('task instruction roles', () => {
  it('does not ship a separate delegated developer instructions file', async () => {
    await expect(fs.stat(path.join(REPO_ROOT, 'DEVELOPER_TASK_INSTRUCTIONS.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('keeps orchestrator and delegated developer instruction roles separate', async () => {
    const rawOrchestratorInstructions = await fs.readFile(ORCHESTRATOR_DEVELOPER_INSTRUCTIONS_FILE, 'utf8');
    const orchestratorInstructions = buildOrchestratorInstructions.call({}, buildInstructionOptions());
    const delegatedInstructions = buildDeveloperInstructions.call({}, buildInstructionOptions());

    expect(rawOrchestratorInstructions).toContain('top-level orchestrator');
    expect(rawOrchestratorInstructions).toContain('coordination, delegation, scope control');
    expect(rawOrchestratorInstructions).toContain('Do not independently expand implementation scope');
    expect(rawOrchestratorInstructions).toContain('delegated `developer` agent');
    expect(rawOrchestratorInstructions).not.toContain('Fully address the request in the repository');

    expect(orchestratorInstructions).toContain('top-level orchestrator');
    expect(orchestratorInstructions).toContain('coordination, delegation, scope control');
    expect(orchestratorInstructions).toContain('create and switch to a readable branch name');
    expect(orchestratorInstructions).toContain('spawn_agent');
    expect(orchestratorInstructions).not.toContain('You are the developer agent.');

    expect(delegatedInstructions).toContain('Fully address the request. Investigate, make the required changes, and finish the implementation before stopping.');
    expect(delegatedInstructions).toContain('Do not add fallbacks or backward-compatibility work unless the request context explicitly asks for it');
    expect(delegatedInstructions).not.toContain('spawn_agent');
    expect(delegatedInstructions).not.toContain('top-level orchestrator');
  });

  it('builds static orchestrator instructions without a codex home or dynamic sections', async () => {
    const instructions = buildOrchestratorInstructions.call({}, buildInstructionOptions());

    expect(instructions).toContain('ephemeral Docker container');
    expect(instructions).toContain('without asking for approval first');
    expect(instructions).toContain('You are the top-level orchestrator for the task.');
    expect(instructions).toContain('creating the final git commit');
    expect(instructions).toContain('create and switch to a readable branch name');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).toContain('spawn_agent');
    expect(instructions).toContain('fork_context = false');
    expect(instructions).toContain('architect` agent');
    expect(instructions).toContain('reviewer` agent');
    expect(instructions).not.toContain('Environment variables');
    expect(instructions).not.toContain('You are the developer agent.');
  });

  it('builds static delegated developer instructions without a codex home or dynamic sections', async () => {
    const instructions = buildDeveloperInstructions.call({}, buildInstructionOptions());

    expect(instructions).toContain('ephemeral Docker container');
    expect(instructions).toContain('without asking for approval first');
    expect(instructions).toContain('Fully address the request. Investigate, make the required changes, and finish the implementation before stopping.');
    expect(instructions).toContain('Do not add fallbacks or backward-compatibility work unless the request context explicitly asks for it');
    expect(instructions).toContain('call out the case in your return summary');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).not.toContain('spawn_agent');
    expect(instructions).not.toContain('fork_context = false');
    expect(instructions).not.toContain('architect` agent');
    expect(instructions).not.toContain('reviewer` agent');
    expect(instructions).not.toContain('Environment variables');
  });
});

describe('task instruction config merging', () => {
  it('merges literal user instructions into orchestrator instructions and omits empty env-var sections', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      "developer_instructions = 'Follow the local handbook.'\n"
    );

    const instructions = buildOrchestratorInstructions.call(
      { codexHome },
      buildInstructionOptions({ envVars: {} })
    );

    expect(instructions).toContain('Follow the local handbook.');
    expect(instructions).toContain('task-orchestrator-instructions');
    expect(instructions).toContain('You are the top-level orchestrator for the task.');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).toContain('Use the `architect` agent');
    expect(instructions).not.toContain('Environment variables');
  });

  it('ignores malformed basic-string user instructions and keeps top-level env vars', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      'developer_instructions = "\\q"\n'
    );

    const instructions = buildOrchestratorInstructions.call(
      { codexHome },
      buildInstructionOptions({
        useHostDockerSocket: true,
        envVars: { SAMPLE_FLAG: '1' },
      })
    );

    expect(instructions).toContain('Docker is enabled for this task via an isolated per-task Docker sidecar daemon.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).toContain('Environment variables');
    expect(instructions).toContain('SAMPLE_FLAG');
    expect(instructions).toContain('Do not independently expand implementation scope');
    expect(instructions).toContain('create a git commit');
    expect(instructions).not.toContain('task-orchestrator-instructions');
    expect(instructions).toContain('Pass the full user request and all task-specific context');
  });
});
