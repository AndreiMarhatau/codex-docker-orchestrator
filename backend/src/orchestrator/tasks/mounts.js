const fs = require('node:fs');

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

function addMountMaps(env, key, maps) {
  const existing = env[key] || '';
  const parts = existing.split(':').filter(Boolean);
  for (const map of maps) {
    const source = map?.source;
    const target = map?.target;
    if (!source || !target || !fs.existsSync(source)) {
      continue;
    }
    const entry = `${source}=${target}`;
    if (!parts.includes(entry)) {
      parts.push(entry);
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

function resolveMountMaps(maps) {
  const unique = [];
  for (const map of maps) {
    const source = map?.source;
    const target = map?.target;
    if (!source || !target || !fs.existsSync(source)) {
      continue;
    }
    if (!unique.some((item) => item.source === source && item.target === target)) {
      unique.push({ source, target });
    }
  }
  return unique;
}

module.exports = {
  addMountPaths,
  addMountMaps,
  resolveMountPaths,
  resolveMountMaps
};
