import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  DEFAULT_MANAGED_AGENTS,
  buildManagedAgentsManifest,
  reconcileManagedAgents
} = require('../../src/orchestrator/managed-agents');

describe('managed agent reconciliation', () => {
  it('writes bundled developer, architect, and reviewer agents plus manifest', async () => {
    const codexHome = await createTempDir();

    const manifest = await reconcileManagedAgents({
      codexHome,
      now: () => '2026-03-23T00:00:00.000Z'
    });

    expect(manifest.agents).toHaveLength(3);
    const developer = await fs.readFile(path.join(codexHome, 'agents', 'developer.toml'), 'utf8');
    const architect = await fs.readFile(path.join(codexHome, 'agents', 'architect.toml'), 'utf8');
    const reviewer = await fs.readFile(path.join(codexHome, 'agents', 'reviewer.toml'), 'utf8');
    expect(developer).toContain('You are the developer agent.');
    expect(developer).toContain('do not stop until verification is good');
    expect(architect).toContain('You are the architect agent.');
    expect(architect).toContain('emerging architectural problem');
    expect(reviewer).toContain('You are the reviewer agent.');
    expect(reviewer).toContain('Review only the current uncommitted changes.');
  });

  it('removes only previously managed files that are no longer bundled', async () => {
    const codexHome = await createTempDir();
    const agentsDir = path.join(codexHome, 'agents');
    const metadataDir = path.join(codexHome, '.codex-docker-orchestrator');
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.mkdir(metadataDir, { recursive: true });
    await fs.writeFile(path.join(agentsDir, 'old-managed.toml'), 'managed old');
    await fs.writeFile(path.join(agentsDir, 'user-agent.toml'), 'user owned');
    await fs.writeFile(
      path.join(metadataDir, 'managed-agents-manifest.json'),
      JSON.stringify({
        version: 1,
        agents: [{ id: 'old-managed', filename: 'old-managed.toml', sha256: 'x' }]
      })
    );

    await reconcileManagedAgents({
      codexHome,
      now: () => '2026-03-23T00:00:00.000Z'
    });

    await expect(fs.stat(path.join(agentsDir, 'user-agent.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(agentsDir, 'developer.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(agentsDir, 'architect.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(agentsDir, 'reviewer.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(agentsDir, 'old-managed.toml'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('allows test overrides for bundled agents', async () => {
    const codexHome = await createTempDir();
    const updatedAgents = [
      ...DEFAULT_MANAGED_AGENTS.filter((agent) => agent.id !== 'architect' && agent.id !== 'reviewer'),
      {
        id: 'developer',
        filename: 'developer.toml',
        content: 'name = "developer"\ndescription = "Updated"\ndeveloper_instructions = "Updated"\n'
      }
    ];

    const manifest = await reconcileManagedAgents({
      codexHome,
      now: () => '2026-03-23T00:00:00.000Z',
      managedAgents: updatedAgents
    });

    expect(manifest).toMatchObject(buildManagedAgentsManifest(updatedAgents));
    const developer = await fs.readFile(path.join(codexHome, 'agents', 'developer.toml'), 'utf8');
    expect(developer).toContain('Updated');
    await expect(fs.stat(path.join(codexHome, 'agents', 'architect.toml'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await expect(fs.stat(path.join(codexHome, 'agents', 'reviewer.toml'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('ignores a malformed existing manifest and still writes the bundled agents', async () => {
    const codexHome = await createTempDir();
    const metadataDir = path.join(codexHome, '.codex-docker-orchestrator');
    await fs.mkdir(metadataDir, { recursive: true });
    await fs.writeFile(path.join(metadataDir, 'managed-agents-manifest.json'), '{');

    const manifest = await reconcileManagedAgents({
      codexHome,
      now: () => '2026-03-23T00:00:00.000Z'
    });

    expect(manifest.agents).toHaveLength(3);
    await expect(fs.stat(path.join(codexHome, 'agents', 'developer.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(codexHome, 'agents', 'architect.toml'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(codexHome, 'agents', 'reviewer.toml'))).resolves.toBeTruthy();
  });

  it('handles concurrent manifest rewrites without temp-file collisions', async () => {
    const codexHome = await createTempDir();
    const originalNow = Date.now;
    Date.now = () => 1774284786868;

    try {
      const [first, second] = await Promise.all([
        reconcileManagedAgents({
          codexHome,
          now: () => '2026-03-23T00:00:00.000Z'
        }),
        reconcileManagedAgents({
          codexHome,
          now: () => '2026-03-23T00:00:00.000Z'
        })
      ]);

      expect(first.agents).toHaveLength(3);
      expect(second.agents).toHaveLength(3);
      const manifest = JSON.parse(
        await fs.readFile(
          path.join(codexHome, '.codex-docker-orchestrator', 'managed-agents-manifest.json'),
          'utf8'
        )
      );
      expect(manifest.agents).toHaveLength(3);
    } finally {
      Date.now = originalNow;
    }
  });
});
