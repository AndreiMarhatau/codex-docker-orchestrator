const path = require('node:path');
const fsp = require('node:fs/promises');
const { pathExists } = require('../storage');

async function listArtifacts(rootDir) {
  if (!(await pathExists(rootDir))) {
    return [];
  }
  const artifacts = [];
  const pending = [rootDir];
  while (pending.length > 0) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (entry.isFile()) {
        try {
          const stat = await fsp.stat(entryPath);
          artifacts.push({
            path: path.relative(rootDir, entryPath),
            size: stat.size
          });
        } catch (error) {
          continue;
        }
      }
    }
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  return artifacts;
}

module.exports = {
  listArtifacts
};
