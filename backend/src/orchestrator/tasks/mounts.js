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

async function addContextRepoMounts(orch, volumeMounts, contextRepos = []) {
  for (const repo of contextRepos) {
    if (!repo?.worktreePath || !repo?.aliasName) {
      continue;
    }
    volumeMounts.push(
      orch.volumeMountFor(repo.worktreePath, `/readonly/${repo.aliasName}`, true)
    );
    if (!repo.envId) {
      continue;
    }
    const contextEnv = await orch.readEnv(repo.envId);
    volumeMounts.push(orch.volumeMountFor(contextEnv.mirrorPath, contextEnv.mirrorPath, true));
  }
}

function buildTaskRunVolumeMounts(orch, {
  worktreePath,
  workspaceDir,
  mirrorPath,
  attachmentsDir,
  hasAttachments,
  contextRepos,
  dockerSocketDir,
  useHostDockerSocket
}) {
  const volumeMounts = [
    orch.volumeMountFor(worktreePath, workspaceDir),
    orch.volumeMountFor(mirrorPath, mirrorPath)
  ];
  if (hasAttachments) {
    volumeMounts.push(orch.volumeMountFor(attachmentsDir, '/attachments', true));
  }
  if (useHostDockerSocket) {
    volumeMounts.push(orch.volumeMountFor(dockerSocketDir, '/var/run/orch-task-docker'));
  }
  return addContextRepoMounts(orch, volumeMounts, contextRepos).then(() => volumeMounts);
}

function buildTaskRunEnvOverrides(envVars, useHostDockerSocket) {
  if (!useHostDockerSocket) {
    return envVars;
  }
  return {
    ...envVars,
    CODEX_CONTAINER_ENV_DOCKER_HOST: 'unix:///var/run/orch-task-docker/docker.sock'
  };
}

module.exports = {
  addMountPaths,
  addMountMaps,
  addContextRepoMounts,
  buildTaskRunEnvOverrides,
  buildTaskRunVolumeMounts,
  resolveMountPaths,
  resolveMountMaps
};
