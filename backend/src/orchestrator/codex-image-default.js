const fs = require('node:fs');
const path = require('node:path');

function findCodexDockerScript(env = process.env) {
  if (env.CODEX_DOCKER_BIN && fs.existsSync(env.CODEX_DOCKER_BIN)) {
    return env.CODEX_DOCKER_BIN;
  }
  for (const entry of String(env.PATH || '').split(path.delimiter)) {
    if (!entry) {
      continue;
    }
    const candidate = path.join(entry, 'codex-docker');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readCodexDockerDefaultImage(scriptPath) {
  if (!scriptPath) {
    return null;
  }
  try {
    const resolved = fs.realpathSync(scriptPath);
    const text = fs.readFileSync(resolved, 'utf8');
    const match = text.match(/IMAGE_NAME="\$\{IMAGE_NAME:-([^}"]+)\}"/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function resolveCodexDockerDefaultImage(fallback) {
  return readCodexDockerDefaultImage(findCodexDockerScript()) || fallback;
}

module.exports = {
  resolveCodexDockerDefaultImage
};
