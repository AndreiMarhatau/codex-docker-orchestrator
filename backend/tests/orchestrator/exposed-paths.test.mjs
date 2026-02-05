import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('task exposed paths', () => {
  it('creates a read-only uploads directory when no attachments exist', async () => {
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

    const uploadsPath = path.join(orchestrator.taskHomeDir(taskId), 'uploads');
    const uploadsStat = await fs.lstat(uploadsPath);
    expect(uploadsStat.isDirectory()).toBe(true);
    expect(uploadsStat.isSymbolicLink()).toBe(false);
    expect(uploadsStat.mode & 0o777).toBe(0o555);
    expect(exposed.uploadsPath).toBe(uploadsPath);

    const codexLink = path.join(orchestrator.taskHomeDir(taskId), '.codex');
    expect(await fs.readlink(codexLink)).toBe(path.join(orchHome, 'codex-home'));
    expect(exposed.readonlyRepositoriesPath).toBe('/readonly');
  });

  it('symlinks uploads and repository aliases when attachments exist', async () => {
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

    const uploadsPath = path.join(orchestrator.taskHomeDir(taskId), 'uploads');
    const uploadsStat = await fs.lstat(uploadsPath);
    expect(uploadsStat.isSymbolicLink()).toBe(true);
    expect(await fs.readlink(uploadsPath)).toBe(attachmentsDir);

    const repositoriesDir = path.join(orchestrator.taskHomeDir(taskId), 'repositories');
    const repoAliasA = path.join(repositoriesDir, 'repo');
    const repoAliasB = path.join(repositoriesDir, 'repo-2');
    expect(await fs.readlink(repoAliasA)).toBe(repoAPath);
    expect(await fs.readlink(repoAliasB)).toBe(repoBPath);
    expect(exposed.contextRepos.map((repo) => repo.aliasName)).toEqual(['repo', 'repo-2']);
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
    const repositoriesDir = path.join(orchestrator.taskHomeDir(taskId), 'repositories');
    await expect(fs.lstat(path.join(repositoriesDir, 'worktree'))).rejects.toThrow();
  });
});
