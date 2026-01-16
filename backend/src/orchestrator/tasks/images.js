const path = require('node:path');
const fsp = require('node:fs/promises');
const { invalidImageError } = require('../errors');

async function resolveImagePath(uploadsRoot, imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.trim()) {
    throw invalidImageError('Invalid image path provided.');
  }
  const resolvedPath = path.resolve(imagePath);
  if (resolvedPath === uploadsRoot || !resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw invalidImageError('Images must be uploaded via orchestrator before use.');
  }
  let stat;
  try {
    stat = await fsp.stat(resolvedPath);
  } catch (error) {
    throw invalidImageError(`Image not found: ${imagePath}`);
  }
  if (!stat.isFile()) {
    throw invalidImageError(`Image not found: ${imagePath}`);
  }
  return resolvedPath;
}

async function resolveImagePaths(orch, imagePaths) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return [];
  }
  if (imagePaths.length > 5) {
    throw invalidImageError('Up to 5 images are supported per request.');
  }
  const uploadsRoot = path.resolve(orch.uploadsDir());
  const resolved = [];
  for (const imagePath of imagePaths) {
    const resolvedPath = await resolveImagePath(uploadsRoot, imagePath);
    if (!resolved.includes(resolvedPath)) {
      resolved.push(resolvedPath);
    }
  }
  return resolved;
}

module.exports = {
  resolveImagePaths
};
