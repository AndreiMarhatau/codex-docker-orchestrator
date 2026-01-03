const { readJson, listDirs, pathExists } = require('../../storage');
const { parseUnifiedDiff } = require('../git');

async function readLocalHead(exec, worktreePath) {
  const headResult = await exec('git', ['-C', worktreePath, 'rev-parse', 'HEAD']);
  if (headResult.code === 0) {
    return headResult.stdout.trim() || null;
  }
  return null;
}

async function readRemoteHead(exec, worktreePath, branchName) {
  const remoteResult = await exec('git', [
    '-C',
    worktreePath,
    'ls-remote',
    '--heads',
    'origin',
    branchName
  ]);
  if (remoteResult.code !== 0) {
    return { remoteHead: null, remoteQueryOk: false };
  }
  const line = remoteResult.stdout.split('\n').find(Boolean);
  const remoteHead = line ? line.split(/\s+/)[0] || null : null;
  return { remoteHead, remoteQueryOk: true };
}

async function readDirtyStatus(exec, worktreePath) {
  const dirtyResult = await exec('git', ['-C', worktreePath, 'status', '--porcelain']);
  if (dirtyResult.code !== 0) {
    return null;
  }
  return dirtyResult.stdout.trim().length > 0;
}

async function readDiffStats(exec, worktreePath, baseSha) {
  if (!baseSha) {
    return null;
  }
  const diffResult = await exec('git', [
    '-C',
    worktreePath,
    'diff',
    '--numstat',
    `${baseSha}...HEAD`
  ]);
  if (diffResult.code !== 0) {
    return null;
  }
  const lines = diffResult.stdout.trim().split('\n').filter(Boolean);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    const [addRaw, delRaw] = line.split('\t');
    const add = Number(addRaw);
    const del = Number(delRaw);
    if (!Number.isNaN(add)) {
      additions += add;
    }
    if (!Number.isNaN(del)) {
      deletions += del;
    }
  }
  return { additions, deletions };
}

function attachTaskMetaMethods(Orchestrator) {
  Orchestrator.prototype.listTasks = async function listTasks() {
    await this.init();
    const taskIds = await listDirs(this.tasksDir());
    const tasks = [];
    for (const taskId of taskIds) {
      const metaPath = this.taskMetaPath(taskId);
      if (!(await pathExists(metaPath))) {
        continue;
      }
      const meta = await readJson(metaPath);
      const gitStatus = await this.getTaskGitStatus(meta);
      tasks.push({ ...meta, gitStatus });
    }
    tasks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return tasks;
  };

  Orchestrator.prototype.getTask = async function getTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const [logTail, runLogs, gitStatus] = await Promise.all([
      this.readLogTail(taskId),
      this.readRunLogs(taskId),
      this.getTaskGitStatus(meta)
    ]);
    return { ...meta, logTail, runLogs, gitStatus };
  };

  Orchestrator.prototype.getTaskMeta = async function getTaskMeta(taskId) {
    return readJson(this.taskMetaPath(taskId));
  };

  Orchestrator.prototype.getTaskGitStatus = async function getTaskGitStatus(meta) {
    if (!meta?.worktreePath) {
      return null;
    }
    const status = {
      hasChanges: null,
      pushed: null,
      dirty: null,
      diffStats: null
    };

    status.dirty = await readDirtyStatus(this.exec, meta.worktreePath);
    status.diffStats = await readDiffStats(this.exec, meta.worktreePath, meta.baseSha);

    if (meta.baseSha) {
      const diffResult = await this.exec('git', [
        '-C',
        meta.worktreePath,
        'diff',
        '--quiet',
        `${meta.baseSha}...HEAD`
      ]);
      if (diffResult.code === 0) {
        status.hasChanges = false;
      }
      if (diffResult.code === 1) {
        status.hasChanges = true;
      }
    }
    if (status.dirty === true && status.hasChanges !== true) {
      status.hasChanges = true;
    }

    const localHead = await readLocalHead(this.exec, meta.worktreePath);
    const { remoteHead, remoteQueryOk } = await readRemoteHead(
      this.exec,
      meta.worktreePath,
      meta.branchName
    );

    if (localHead && remoteQueryOk) {
      status.pushed = remoteHead ? remoteHead === localHead : false;
    }

    return status;
  };

  Orchestrator.prototype.getTaskDiff = async function getTaskDiff(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.baseSha) {
      return {
        available: false,
        reason: 'Base commit was not recorded for this task.'
      };
    }
    try {
      const result = await this.execOrThrow('git', [
        '-C',
        meta.worktreePath,
        'diff',
        '--no-color',
        `${meta.baseSha}...HEAD`
      ]);
      const files = parseUnifiedDiff(result.stdout);
      return {
        available: true,
        baseSha: meta.baseSha,
        files
      };
    } catch (error) {
      return {
        available: false,
        reason: error.message || 'Unable to generate diff.'
      };
    }
  };
}

module.exports = {
  attachTaskMetaMethods
};
