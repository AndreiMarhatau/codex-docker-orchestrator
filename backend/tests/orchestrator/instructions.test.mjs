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

  it('does not inject orchestrator or delegated developer workflows', async () => {
    const rawOrchestratorInstructions = await fs.readFile(ORCHESTRATOR_DEVELOPER_INSTRUCTIONS_FILE, 'utf8');
    const orchestratorInstructions = buildOrchestratorInstructions.call({}, buildInstructionOptions());
    const delegatedInstructions = buildDeveloperInstructions.call({}, buildInstructionOptions());

    expect(rawOrchestratorInstructions).toContain('top-level orchestrator');
    expect(rawOrchestratorInstructions).toContain('coordinate, delegate, control');
    expect(rawOrchestratorInstructions).toContain('Keep working with the \'developer\' subagent until acceptance criteria are met fully and verified.');
    expect(rawOrchestratorInstructions).toContain("delegate to the 'developer' subagent");
    expect(rawOrchestratorInstructions).not.toContain('Fully address the request in the repository');

    expect(orchestratorInstructions).toContain('ephemeral Docker container');
    expect(orchestratorInstructions).not.toContain('top-level orchestrator');
    expect(orchestratorInstructions).not.toContain('coordinate, delegate, control');
    expect(orchestratorInstructions).not.toContain("Create a meaningful branch with name starting with 'codex/' if not yet done.");
    expect(orchestratorInstructions).not.toContain('spawn_agent');
    expect(orchestratorInstructions).not.toContain('You are the developer agent.');

    expect(delegatedInstructions).toContain('ephemeral Docker container');
    expect(delegatedInstructions).not.toContain('Fully address the request. Investigate, make the required changes, and finish the implementation before stopping.');
    expect(delegatedInstructions).not.toContain('Do not add fallbacks or backward-compatibility work unless the request context explicitly asks for it');
    expect(delegatedInstructions).not.toContain('spawn_agent');
    expect(delegatedInstructions).not.toContain('top-level orchestrator');
  });

  it('builds static orchestrator instructions without a codex home or dynamic sections', async () => {
    const instructions = buildOrchestratorInstructions.call({}, buildInstructionOptions());
    const preambleCount = instructions.split('You are running inside an ephemeral Docker container').length - 1;

    expect(instructions).toContain('ephemeral Docker container');
    expect(instructions).toContain('without asking the user for approval first');
    expect(instructions).not.toContain('You are the top-level orchestrator for user requests.');
    expect(instructions).not.toContain('Stage and commit using a concise commit message.');
    expect(instructions).not.toContain("Create a meaningful branch with name starting with 'codex/' if not yet done.");
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).not.toContain('spawn_agent');
    expect(instructions).not.toContain('fork_context = false');
    expect(instructions).not.toContain("'architect' review");
    expect(instructions).not.toContain("'reviewer' has to review the changes");
    expect(instructions).not.toContain('Environment variables');
    expect(instructions).not.toContain('You are the developer agent.');
    expect(preambleCount).toBe(1);
  });

  it('builds static delegated developer instructions without a codex home or dynamic sections', async () => {
    const instructions = buildDeveloperInstructions.call({}, buildInstructionOptions());

    expect(instructions).toContain('ephemeral Docker container');
    expect(instructions).toContain('without asking the user for approval first');
    expect(instructions).not.toContain('Fully address the request. Investigate, make the required changes, and finish the implementation before stopping.');
    expect(instructions).not.toContain('Do not add fallbacks or backward-compatibility work unless the request context explicitly asks for it');
    expect(instructions).not.toContain('call out the case in your return summary');
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

    expect(instructions).not.toContain('Follow the local handbook.');
    expect(instructions).not.toContain('task-orchestrator-instructions');
    expect(instructions).not.toContain('You are the top-level orchestrator for user requests.');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).not.toContain('decide if you need \'architect\' review');
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
    expect(instructions).not.toContain('Environment variables');
    expect(instructions).not.toContain('SAMPLE_FLAG');
    expect(instructions).not.toContain('Keep working with the \'developer\' subagent until acceptance criteria are met fully and verified.');
    expect(instructions).not.toContain('Stage and commit using a concise commit message.');
    expect(instructions).not.toContain('task-orchestrator-instructions');
    expect(instructions).not.toContain('Provide user request, any additional details, including what YOU as an orchestrator expect from the subagent.');
  });
});
