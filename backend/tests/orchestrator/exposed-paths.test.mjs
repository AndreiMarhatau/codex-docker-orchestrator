import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('task exposed paths', () => {
  it('returns container mount paths and removes legacy task-home aliases', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn: createMockSpawn()
    });

    const taskId = 'task-1';
    const exposed = await orchestrator.prepareTaskExposedPaths(taskId, {
      contextRepos: [],
      attachments: [],
      codexHome: path.join(orchHome, 'codex-home')
    });

    expect(exposed.uploadsPath).toBe('/attachments');
    expect(exposed.readonlyAttachmentsPath).toBe('/attachments');
    expect(exposed.repositoriesPath).toBe('/readonly');
    expect(exposed.repositoriesAliasPath).toBe('/readonly');
    expect(exposed.readonlyRepositoriesPath).toBe('/readonly');

    const codexLink = path.join(orchestrator.taskHomeDir(taskId), '.codex');
    expect(await fs.readlink(codexLink)).toBe(path.join(orchHome, 'codex-home'));
    await expect(fs.lstat(path.join(orchestrator.taskHomeDir(taskId), 'uploads'))).rejects.toThrow();
    await expect(fs.lstat(path.join(orchestrator.taskHomeDir(taskId), 'repositories'))).rejects.toThrow();
    await expect(fs.lstat(path.join(orchestrator.taskHomeDir(taskId), 'repos'))).rejects.toThrow();
  });

  it('preserves aliasing logic for readonly repo mounts', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn: createMockSpawn()
    });

    const taskId = 'task-2';
    const repoAPath = path.join(orchHome, 'repo-a');
    const repoBPath = path.join(orchHome, 'repo-b');
    await fs.mkdir(repoAPath, { recursive: true });
    await fs.mkdir(repoBPath, { recursive: true });

    const contextRepos = [
      {
        envId: 'env-1',
        repoUrl: 'git@example.com:repo.git',
        ref: 'main',
        worktreePath: repoAPath
      },
      {
        envId: 'env-2',
        repoUrl: 'git@example.com:repo.git',
        ref: 'main',
        worktreePath: repoBPath
      }
    ];

    const attachmentsDir = orchestrator.taskAttachmentsDir(taskId);
    await fs.mkdir(attachmentsDir, { recursive: true });

    const exposed = await orchestrator.prepareTaskExposedPaths(taskId, {
      contextRepos,
      attachments: [{ name: 'file.txt', path: path.join(attachmentsDir, 'file.txt') }]
    });

    expect(exposed.contextRepos.map((repo) => repo.aliasName)).toEqual(['repo', 'repo-2']);
    expect(exposed.uploadsPath).toBe('/attachments');
    expect(exposed.repositoriesPath).toBe('/readonly');
    expect(exposed.readonlyRepositoriesPath).toBe('/readonly');
  });

  it('assigns default repo alias when repo name is missing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn: createMockSpawn()
    });

    const taskId = 'task-3';
    const exposed = await orchestrator.prepareTaskExposedPaths(taskId, {
      contextRepos: [{ envId: '', repoUrl: '', ref: '', worktreePath: null }],
      attachments: []
    });

    expect(exposed.contextRepos).toHaveLength(1);
    expect(exposed.contextRepos[0].aliasName).toBe('worktree');
  });
});
