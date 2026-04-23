function getElapsedMs(startedAt, finishedAt, now) {
  if (!startedAt) {
    return null;
  }
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) {
    return null;
  }
  const end = finishedAt ? Date.parse(finishedAt) : now;
  if (Number.isNaN(end)) {
    return null;
  }
  return Math.max(0, end - start);
}

function getRunDurationMs(run, now) {
  if (!run || typeof run !== 'object') {
    return null;
  }
  return getElapsedMs(run.startedAt, run.finishedAt, now);
}

function getLatestRun(task) {
  const runs = Array.isArray(task?.runs) && task.runs.length > 0
    ? task.runs
    : Array.isArray(task?.runLogs)
      ? task.runLogs
      : [];
  if (runs.length === 0) {
    return null;
  }
  return runs[runs.length - 1];
}

function getTaskRuntimeMs(task, now) {
  if (!task || typeof task !== 'object') {
    return null;
  }
  const latestRun = getLatestRun(task);
  if (latestRun) {
    return getRunDurationMs(latestRun, now);
  }
  return null;
}

function encodeArtifactPath(value) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isImageArtifact(value) {
  const lower = value.toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.bmp')
  );
}

export {
  encodeArtifactPath,
  getElapsedMs,
  getLatestRun,
  getRunDurationMs,
  getTaskRuntimeMs,
  isImageArtifact
};
