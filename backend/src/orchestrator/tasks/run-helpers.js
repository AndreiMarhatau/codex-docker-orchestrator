const { readJson, writeJson } = require('../../storage');
const { listArtifacts } = require('../artifacts');
const { parseThreadId, safeJsonParse, isUsageLimitError } = require('../logs');
const {
  DEFAULT_GIT_CONFIG_CONTAINER_PATH,
  DEFAULT_INNER_ARTIFACTS_DIR,
  DEFAULT_INNER_CODEX_HOME
} = require('../constants');

function mergePassthroughEnv(env, keys) {
  const existing = env.CODEX_PASSTHROUGH_ENV;
  const merged = new Set(
    (existing || '').split(',').map((entry) => entry.trim()).filter(Boolean)
  );
  for (const key of keys) {
    if (key) {
      merged.add(key);
    }
  }
  if (merged.size === 0) {
    delete env.CODEX_PASSTHROUGH_ENV;
    return;
  }
  env.CODEX_PASSTHROUGH_ENV = Array.from(merged).join(',');
}
function applyEnvOverrides(env, envOverrides) {
  if (!envOverrides) {
    return;
  }
  const keys = Object.keys(envOverrides);
  const passthroughKeys = [];
  for (const key of keys) {
    if (!key) {
      continue;
    }
    env[key] = String(envOverrides[key]);
    if (!key.startsWith('CODEX_CONTAINER_ENV_')) {
      passthroughKeys.push(key);
    }
  }
  mergePassthroughEnv(env, passthroughKeys);
}
function buildRunEnv({
  orchestrator,
  workspaceDir,
  artifactsDir,
  volumeMounts = [],
  envOverrides
}) {
  const env = orchestrator.withRuntimeEnv();
  delete env.CODEX_HOME;
  delete env.CODEX_MOUNT_PATHS;
  delete env.CODEX_MOUNT_PATHS_RO;
  delete env.CODEX_MOUNT_MAPS;
  delete env.CODEX_MOUNT_MAPS_RO;
  delete env.CODEX_ARTIFACTS_DIR;
  const combinedVolumeMounts = [
    orchestrator.volumeMountFor(orchestrator.codexHome, DEFAULT_INNER_CODEX_HOME),
    orchestrator.volumeMountFor(artifactsDir, DEFAULT_INNER_ARTIFACTS_DIR),
    orchestrator.gitConfigVolumeMount(),
    ...volumeMounts
  ];
  env.CODEX_VOLUME_MOUNTS = combinedVolumeMounts.join(',');
  env.CODEX_WORKSPACE_DIR = workspaceDir;
  env.GIT_CONFIG_GLOBAL = DEFAULT_GIT_CONFIG_CONTAINER_PATH;
  mergePassthroughEnv(env, ['GIT_CONFIG_GLOBAL', 'GH_TOKEN']);
  applyEnvOverrides(env, envOverrides);
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
// eslint-disable-next-line complexity
async function updateRunMeta({
  taskId,
  runLabel,
  result,
  prompt,
  now,
  taskMetaPath,
  runArtifactsDir,
  isStopped
}) {
  const meta = await readJson(taskMetaPath(taskId));
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const threadId = result.threadId || parseThreadId(combinedOutput);
  const resolvedThreadId = threadId || meta.threadId || null;
  const usageLimit = isUsageLimitError(result.stdout);
  const currentTime = now();
  const artifactsDir = runArtifactsDir(taskId, runLabel);
  const artifacts = await listArtifacts(artifactsDir);
  const stopped = result.stopped === true || isStopped?.() === true;
  if (stopped) {
    result.stopped = true;
  }
  const success = !stopped && result.code === 0 && !!resolvedThreadId;

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
      gitFingerprintBefore: result.gitFingerprintBefore || meta.runs[runIndex].gitFingerprintBefore || null,
      gitFingerprintAfter: result.gitFingerprintAfter || meta.runs[runIndex].gitFingerprintAfter || null,
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
