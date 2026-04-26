import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createTempDir, prepareOrchestratorSetup } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

export async function createCompletedTask(orchestrator, env) {
  const taskId = `task-${Math.random().toString(16).slice(2)}`;
  const taskDir = orchestrator.taskDir(taskId);
  const worktreePath = path.join(taskDir, 'repo');
  const runId = 'run-001';
  await fs.mkdir(worktreePath, { recursive: true });
  await fs.mkdir(orchestrator.taskLogsDir(taskId), { recursive: true });
  await fs.mkdir(orchestrator.runArtifactsDir(taskId, runId), { recursive: true });
  await fs.writeFile(path.join(orchestrator.taskLogsDir(taskId), `${runId}.jsonl`), '');
  await fs.writeFile(
    orchestrator.taskMetaPath(taskId),
    JSON.stringify({
      taskId,
      envId: env.envId,
      repoUrl: env.repoUrl,
      branchName: 'codex/test-task',
      worktreePath,
      threadId: 'thread-1',
      status: 'completed',
      error: null,
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
      useHostDockerSocket: false,
      attachments: [],
      contextRepos: [],
      runs: [{
        runId,
        prompt: 'Do work',
        logFile: `${runId}.jsonl`,
        startedAt: '2026-04-27T00:00:00.000Z',
        finishedAt: '2026-04-27T00:01:00.000Z',
        status: 'completed',
        exitCode: 0
      }]
    }, null, 2)
  );
  return taskId;
}

export async function createCompletedTaskContext({ exec, spawn }) {
  const orchHome = await createTempDir();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome: path.join(orchHome, 'codex-home'),
    exec,
    spawn
  });
  orchestrator.appServerShutdownTimeoutMs = 1;
  await prepareOrchestratorSetup(orchestrator);
  const env = await orchestrator.createEnv({
    repoUrl: 'git@example.com:repo.git',
    defaultBranch: 'main'
  });
  const taskId = await createCompletedTask(orchestrator, env);
  return { env, orchestrator, taskId };
}
