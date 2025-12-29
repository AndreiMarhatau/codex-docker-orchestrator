const path = require('node:path');
const fs = require('node:fs/promises');

async function resolveRun(orchestrator, taskId, runId) {
  const task = await orchestrator.getTask(taskId);
  const resolvedRunId = runId || task.runs?.[task.runs.length - 1]?.runId || null;
  if (!resolvedRunId) {
    return { task, run: null };
  }
  const run = task.runs.find((entry) => entry.runId === resolvedRunId);
  return { task, run };
}

async function readExistingLog(logPath) {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const stat = await fs.stat(logPath);
    return { lineCount: lines.length, filePosition: stat.size };
  } catch (error) {
    return { lineCount: 0, filePosition: 0 };
  }
}

function sendEntry(res, runId, entry) {
  res.write(`data: ${JSON.stringify({ runId, entry })}\n\n`);
}

function parseLogLine(line, lineCount) {
  let parsed = null;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    parsed = null;
  }
  return {
    id: `log-${lineCount}`,
    type: parsed?.type || 'text',
    raw: line,
    parsed
  };
}

async function streamTaskLogs(orchestrator, req, res) {
  const { taskId } = req.params;
  try {
    const { run } = await resolveRun(orchestrator, taskId, req.query.runId);
    if (!run) {
      return res.status(404).send('Run not found.');
    }
    const logPath = path.join(orchestrator.taskLogsDir(taskId), run.logFile);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    let { lineCount, filePosition } = await readExistingLog(logPath);
    let buffer = '';

    const interval = setInterval(async () => {
      try {
        const stat = await fs.stat(logPath);
        if (stat.size <= filePosition) {
          return;
        }
        const handle = await fs.open(logPath, 'r');
        const length = stat.size - filePosition;
        const readBuffer = Buffer.alloc(length);
        await handle.read(readBuffer, 0, length, filePosition);
        await handle.close();
        filePosition = stat.size;
        buffer += readBuffer.toString('utf8');
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            lineCount += 1;
            sendEntry(res, run.runId, parseLogLine(line, lineCount));
          }
          newlineIndex = buffer.indexOf('\n');
        }
      } catch (error) {
        // Ignore stream errors.
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
    return null;
  } catch (error) {
    return res.status(404).send('Task not found.');
  }
}

module.exports = {
  streamTaskLogs
};
