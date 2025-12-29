const path = require('node:path');
const fsp = require('node:fs/promises');
const { readJson } = require('../../storage');
const { parseLogEntries } = require('../logs');

async function readLogFile(logPath) {
  try {
    return await fsp.readFile(logPath, 'utf8');
  } catch (error) {
    return '';
  }
}

function attachTaskLogMethods(Orchestrator) {
  Orchestrator.prototype.readLogTail = async function readLogTail(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const latestRun = meta.runs[meta.runs.length - 1];
    if (!latestRun) {
      return '';
    }
    const logPath = path.join(this.taskLogsDir(taskId), latestRun.logFile);
    const content = await readLogFile(logPath);
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-120).join('\n');
  };

  Orchestrator.prototype.readRunLogs = async function readRunLogs(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const runs = [];
    for (const run of meta.runs || []) {
      const logPath = path.join(this.taskLogsDir(taskId), run.logFile);
      const content = await readLogFile(logPath);
      runs.push({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || null,
        prompt: run.prompt,
        logFile: run.logFile,
        artifacts: run.artifacts || [],
        entries: parseLogEntries(content)
      });
    }
    return runs;
  };
}

module.exports = {
  attachTaskLogMethods
};
