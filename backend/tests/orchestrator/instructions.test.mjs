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
    expect(instructions).not.toContain('Host Docker Socket');
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
    expect(instructions).not.toContain('Environment variables');
  });

  it('ignores malformed basic-string user instructions', async () => {
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

    expect(instructions).toContain('Host Docker Socket');
    expect(instructions).toContain('Environment variables');
    expect(instructions).not.toContain('orchestrator-developer-instructions');
  });
});
