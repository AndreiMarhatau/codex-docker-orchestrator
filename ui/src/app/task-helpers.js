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

function getLatestRun(task) {
  if (!task?.runs || task.runs.length === 0) {
    return null;
  }
  return task.runs[task.runs.length - 1];
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
  isImageArtifact
};
