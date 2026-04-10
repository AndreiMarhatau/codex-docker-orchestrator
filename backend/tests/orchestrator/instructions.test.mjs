import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { buildDeveloperInstructions } = require('../../src/orchestrator/tasks/instructions');

describe('developer instructions builder', () => {
  it('builds static instructions without a codex home or dynamic sections', async () => {
    const instructions = buildDeveloperInstructions.call(
      {},
      {
        useHostDockerSocket: false,
        contextRepos: [],
        attachments: [],
        envVars: null,
        exposedPaths: {
          uploadsPath: '/attachments',
          repositoriesPath: '/readonly',
          repositoriesAliasPath: '/readonly',
          contextRepos: []
        }
      }
    );

    expect(instructions).toContain('ephemeral Docker container');
    expect(instructions).toContain('delegate with `spawn_agent`');
    expect(instructions).toContain('use `fork_context = false` unless you strictly need');
    expect(instructions).toContain('do not pass general Codex runtime or container details');
    expect(instructions).toContain('Make a quick decision first');
    expect(instructions).toContain('Do not add fallbacks or backward-compatibility work unless the user explicitly asks for it');
    expect(instructions).toContain('Do not do repository investigation, code review, architect review, or reviewer work yourself');
    expect(instructions).toContain('developer` agent does not inherit it automatically');
    expect(instructions).toContain('including defined CI requirements');
    expect(instructions).toContain('If the `developer` agent made any change, run the `reviewer` agent');
    expect(instructions).toContain('whether Docker is enabled or disabled for the task');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).not.toContain('Environment variables');
  });

  it('merges literal user instructions and omits empty env-var sections', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      "developer_instructions = 'Follow the local handbook.'\n"
    );

    const instructions = buildDeveloperInstructions.call(
      { codexHome },
      {
        useHostDockerSocket: false,
        contextRepos: [],
        attachments: [],
        envVars: {},
        exposedPaths: {
          uploadsPath: '/attachments',
          repositoriesPath: '/readonly',
          repositoriesAliasPath: '/readonly',
          contextRepos: []
        }
      }
    );

    expect(instructions).toContain('Follow the local handbook.');
    expect(instructions).toContain('orchestrator-developer-instructions');
    expect(instructions).toContain('prefer informing the user about the case instead of overcomplicating the implementation');
    expect(instructions).toContain('Use the `architect` agent when changes affect infrastructure');
    expect(instructions).toContain('Docker is disabled for this task.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).not.toContain('Environment variables');
  });

  it('ignores malformed basic-string user instructions and keeps top-level env vars', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      'developer_instructions = "\\q"\n'
    );

    const instructions = buildDeveloperInstructions.call(
      { codexHome },
      {
        useHostDockerSocket: true,
        contextRepos: [],
        attachments: [],
        envVars: { SAMPLE_FLAG: '1' },
        exposedPaths: {
          uploadsPath: '/attachments',
          repositoriesPath: '/readonly',
          repositoriesAliasPath: '/readonly',
          contextRepos: []
        }
      }
    );

    expect(instructions).toContain('Docker is enabled for this task via an isolated per-task Docker sidecar daemon.');
    expect(instructions).toContain('/root/.artifacts');
    expect(instructions).toContain('Environment variables');
    expect(instructions).toContain('SAMPLE_FLAG');
    expect(instructions).toContain('backward-compatibility work unless the user explicitly asks for it');
    expect(instructions).toContain('Treat architect findings as complete only when they define both the architectural problem');
    expect(instructions).toContain('Pass the full user request and all task-specific context');
    expect(instructions).not.toContain('orchestrator-developer-instructions');
  });
});
