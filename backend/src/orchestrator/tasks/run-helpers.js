const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJson, writeJson } = require('../../storage');
const { listArtifacts } = require('../artifacts');
const { parseThreadId, safeJsonParse, isUsageLimitError } = require('../logs');

function ensureCodexHome(env, codexHome) {
  const homeDir = env.HOME || os.homedir();
  env.HOME = homeDir;
  env.CODEX_HOME = codexHome || env.CODEX_HOME || path.join(homeDir, '.codex');
  try {
    fs.mkdirSync(env.CODEX_HOME, { recursive: true });
  } catch (error) {
    // Best-effort: codex can still run if the directory is created elsewhere.
  }
}

function addMountPaths(env, key, paths) {
  const existing = env[key] || '';
  const parts = existing.split(':').filter(Boolean);
  for (const mountPath of paths) {
    if (!mountPath || !fs.existsSync(mountPath)) {
      continue;
    }
    if (!parts.includes(mountPath)) {
      parts.push(mountPath);
    }
  }
  if (parts.length > 0) {
    env[key] = parts.join(':');
  } else {
    delete env[key];
  }
}

function resolveMountPaths(paths) {
  const unique = [];
  for (const mountPath of paths) {
    if (!mountPath || !fs.existsSync(mountPath)) {
      continue;
    }
    if (!unique.includes(mountPath)) {
      unique.push(mountPath);
    }
  }
  return unique;
}

function buildRunEnv({ codexHome, artifactsDir, mountPaths, mountPathsRo, agentsAppendFile }) {
  const env = { ...process.env };
  ensureCodexHome(env, codexHome);
  if (agentsAppendFile) {
    env.CODEX_AGENTS_APPEND_FILE = agentsAppendFile;
  }
  env.CODEX_ARTIFACTS_DIR = artifactsDir;
  const rwMounts = resolveMountPaths([codexHome, artifactsDir, ...mountPaths]);
  addMountPaths(env, 'CODEX_MOUNT_PATHS', rwMounts);
  const roMounts = resolveMountPaths(mountPathsRo).filter((item) => !rwMounts.includes(item));
  addMountPaths(env, 'CODEX_MOUNT_PATHS_RO', roMounts);
  return env;
}

function createOutputTracker({ logStream, stderrStream }) {
  let stdoutBuffer = '';
  let stdoutFull = '';
  let stderrFull = '';
  let detectedThreadId = null;

  const onStdout = (chunk) => {
    const text = chunk.toString();
    logStream.write(text);
    stdoutFull += text;
    stdoutBuffer += text;
    let index = stdoutBuffer.indexOf('\n');
    while (index !== -1) {
      const line = stdoutBuffer.slice(0, index).trim();
      stdoutBuffer = stdoutBuffer.slice(index + 1);
      if (line) {
        const payload = safeJsonParse(line);
        if (payload?.type === 'thread.started' && payload.thread_id) {
          detectedThreadId = payload.thread_id;
        }
      }
      index = stdoutBuffer.indexOf('\n');
    }
  };

  const onStderr = (chunk) => {
    const text = chunk.toString();
    stderrStream.write(text);
    stderrFull += text;
  };

  const getResult = () => ({
    stdout: stdoutFull,
    stderr: stderrFull,
    threadId: detectedThreadId
  });

  return { onStdout, onStderr, getResult };
}

async function updateRunMeta({ taskId, runLabel, result, prompt, now, taskMetaPath, runArtifactsDir }) {
  const meta = await readJson(taskMetaPath(taskId));
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const threadId = result.threadId || parseThreadId(combinedOutput);
  const resolvedThreadId = threadId || meta.threadId || null;
  const stopped = result.stopped === true;
  const usageLimit = isUsageLimitError(combinedOutput);
  const success = !stopped && result.code === 0 && !!resolvedThreadId && !usageLimit;
  const currentTime = now();
  const artifactsDir = runArtifactsDir(taskId, runLabel);
  const artifacts = await listArtifacts(artifactsDir);

  meta.threadId = resolvedThreadId;
  meta.error = success
    ? null
    : stopped
      ? 'Stopped by user.'
      : usageLimit
        ? 'Usage limit reached.'
        : 'Unable to parse thread_id from codex output.';
  meta.status = success ? 'completed' : stopped ? 'stopped' : 'failed';
  meta.updatedAt = currentTime;
  meta.lastPrompt = prompt || meta.lastPrompt || null;

  const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
  if (runIndex !== -1) {
    meta.runs[runIndex] = {
      ...meta.runs[runIndex],
      finishedAt: currentTime,
      status: success ? 'completed' : stopped ? 'stopped' : 'failed',
      exitCode: result.code,
      artifacts
    };
  }

  await writeJson(taskMetaPath(taskId), meta);
  return { meta, usageLimit, success };
}

module.exports = {
  buildRunEnv,
  createOutputTracker,
  updateRunMeta
};
