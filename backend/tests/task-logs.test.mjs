import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { streamTaskLogs } = require('../src/app/routes/task-logs');

function createResponseRecorder() {
  const res = {
    statusCode: null,
    headers: {},
    chunks: [],
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(chunk);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    }
  };
  return res;
}

describe('task logs stream', () => {
  it('streams log entries and clears interval on close', async () => {
    const root = await createTempDir();
    const taskId = 'task-1';
    const runId = 'run-001';
    const logsDir = path.join(root, taskId, 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const logFile = `${runId}.jsonl`;
    const logPath = path.join(logsDir, logFile);
    await fs.writeFile(logPath, '');

    const orchestrator = {
      getTask: async () => ({ runs: [{ runId, logFile }] }),
      taskLogsDir: () => logsDir
    };
    const req = new EventEmitter();
    req.params = { taskId };
    req.query = { runId };
    const res = createResponseRecorder();

    await streamTaskLogs(orchestrator, req, res);
    await fs.appendFile(logPath, JSON.stringify({ type: 'thread.started', thread_id: 'abc' }) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    req.emit('close');

    const payload = res.chunks.join('');
    expect(res.statusCode).toBe(200);
    expect(payload).toContain('data:');
    expect(payload).toContain(runId);
  });

  it('returns 404 when task is missing', async () => {
    const orchestrator = {
      getTask: async () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
      taskLogsDir: () => '/tmp'
    };
    const req = new EventEmitter();
    req.params = { taskId: 'missing' };
    req.query = {};
    const res = createResponseRecorder();

    await streamTaskLogs(orchestrator, req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('Task not found.');
  });

  it('returns 404 when run is missing', async () => {
    const orchestrator = {
      getTask: async () => ({ runs: [] }),
      taskLogsDir: () => '/tmp'
    };
    const req = new EventEmitter();
    req.params = { taskId: 'task-1' };
    req.query = {};
    const res = createResponseRecorder();

    await streamTaskLogs(orchestrator, req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('Run not found.');
  });
});
