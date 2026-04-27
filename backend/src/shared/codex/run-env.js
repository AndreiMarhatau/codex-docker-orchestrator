const {
  DEFAULT_GIT_CONFIG_CONTAINER_PATH,
  DEFAULT_INNER_ARTIFACTS_DIR,
  DEFAULT_INNER_CODEX_HOME
} = require('../config/constants');

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
  const passthroughKeys = [];
  for (const key of Object.keys(envOverrides)) {
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

function buildRunEnv({ orchestrator, workspaceDir, artifactsDir, volumeMounts = [], envOverrides }) {
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

module.exports = {
  applyEnvOverrides,
  buildRunEnv,
  mergePassthroughEnv
};
