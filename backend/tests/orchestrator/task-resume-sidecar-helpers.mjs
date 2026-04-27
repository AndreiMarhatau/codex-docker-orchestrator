import fs from 'node:fs/promises';
import path from 'node:path';

export async function setupDockerResumeTask(orchestrator, orchHome) {
  const envDir = path.join(orchHome, 'envs', 'env-1');
  await fs.mkdir(envDir, { recursive: true });
  await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
  await fs.writeFile(path.join(envDir, 'default_branch'), 'main');
  const taskDir = path.join(orchHome, 'tasks', 'task-1');
  await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
  await fs.writeFile(
    path.join(taskDir, 'meta.json'),
    JSON.stringify({
      taskId: 'task-1',
      envId: 'env-1',
      threadId: 'thread-1',
      worktreePath: path.join(taskDir, 'worktree'),
      branchName: 'codex/task-1',
      useHostDockerSocket: true,
      runs: [
        {
          runId: 'run-001',
          prompt: 'start',
          logFile: 'run-001.jsonl',
          startedAt: 'now',
          status: 'completed'
        }
      ]
    })
  );
}
