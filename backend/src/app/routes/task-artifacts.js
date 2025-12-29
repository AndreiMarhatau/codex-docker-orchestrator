const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

function isPathWithin(basePath, targetPath) {
  return targetPath.startsWith(`${basePath}${path.sep}`);
}

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp'
  };
  return types[ext] || 'application/octet-stream';
}

async function ensureArtifactsRoot(orchestrator, taskId, runId) {
  const artifactsRoot = path.resolve(orchestrator.runArtifactsDir(taskId, runId));
  try {
    const stat = await fs.stat(artifactsRoot);
    if (!stat.isDirectory()) {
      return null;
    }
  } catch (error) {
    return null;
  }
  return artifactsRoot;
}

async function serveArtifact(orchestrator, req, res) {
  const { taskId, runId } = req.params;
  const requestedPath = req.params[0];
  if (!requestedPath) {
    return res.status(400).send('Artifact path is required.');
  }
  let meta;
  try {
    meta = await orchestrator.getTaskMeta(taskId);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).send('Task not found');
    }
    throw error;
  }
  const runEntry = (meta.runs || []).find((entry) => entry.runId === runId);
  if (!runEntry) {
    return res.status(404).send('Run not found.');
  }
  const artifactsRoot = await ensureArtifactsRoot(orchestrator, taskId, runId);
  if (!artifactsRoot) {
    return res.status(404).send('Artifacts directory not found.');
  }
  const resolvedPath = path.resolve(artifactsRoot, requestedPath);
  if (!isPathWithin(artifactsRoot, resolvedPath)) {
    return res.status(400).send('Invalid artifact path.');
  }
  let stat;
  try {
    stat = await fs.stat(resolvedPath);
  } catch (error) {
    return res.status(404).send('Artifact not found.');
  }
  if (!stat.isFile()) {
    return res.status(404).send('Artifact not found.');
  }
  res.setHeader('Content-Type', contentTypeForPath(resolvedPath));
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(resolvedPath)}"`);
  const stream = fsSync.createReadStream(resolvedPath);
  stream.on('error', () => {
    res.status(404).send('Artifact not found.');
  });
  stream.pipe(res);
  return null;
}

module.exports = {
  serveArtifact
};
