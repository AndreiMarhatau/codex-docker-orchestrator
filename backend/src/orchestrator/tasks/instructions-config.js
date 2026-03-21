const fs = require('node:fs');
const path = require('node:path');
const toml = require('toml');

function combineProfiles(baseProfiles = {}, nextProfiles = {}) {
  const mergedProfiles = { ...baseProfiles };
  for (const [profileName, profileValue] of Object.entries(nextProfiles)) {
    mergedProfiles[profileName] = {
      ...(baseProfiles[profileName] || {}),
      ...(profileValue || {})
    };
  }
  return mergedProfiles;
}

function mergeConfigInstructions(baseConfig, nextConfig) {
  return {
    profile: typeof nextConfig?.profile === 'string' ? nextConfig.profile : baseConfig.profile,
    developer_instructions:
      typeof nextConfig?.developer_instructions === 'string'
        ? nextConfig.developer_instructions
        : baseConfig.developer_instructions,
    profiles: combineProfiles(baseConfig.profiles, nextConfig?.profiles)
  };
}

function readConfigFile(configPath) {
  try {
    return fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw new Error(
      `Failed to read Codex config file at ${configPath}: ${error?.message || 'Unknown error'}`
    );
  }
}

function parseConfigFile(content) {
  if (content === null) {
    return null;
  }
  try {
    return toml.parse(content);
  } catch (error) {
    return null;
  }
}

function collectInstructionConfigPaths(codexHome, cwd) {
  const seen = new Set();
  const configPaths = [];
  const pushPath = (candidate) => {
    if (!candidate || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    configPaths.push(candidate);
  };

  if (codexHome) {
    pushPath(path.join(codexHome, 'config.toml'));
  }
  if (!cwd) {
    return configPaths;
  }

  let currentDir = path.resolve(cwd);
  pushPath(path.join(currentDir, 'config.toml'));
  for (;;) {
    pushPath(path.join(currentDir, '.codex', 'config.toml'));
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return configPaths;
    }
    currentDir = parentDir;
  }
}

function getDeveloperInstructions(config) {
  const activeProfile =
    typeof config.profile === 'string' && config.profile.trim() ? config.profile.trim() : null;
  const profileInstructions = activeProfile ? config.profiles?.[activeProfile]?.developer_instructions : null;
  const developerInstructions =
    typeof profileInstructions === 'string' && profileInstructions.trim()
      ? profileInstructions
      : typeof config.developer_instructions === 'string'
        ? config.developer_instructions
        : '';
  return developerInstructions.trim();
}

function readConfigDeveloperInstructions({ codexHome, cwd }) {
  const mergedConfig = collectInstructionConfigPaths(codexHome, cwd).reduce(
    (config, configPath) => {
      const parsed = parseConfigFile(readConfigFile(configPath));
      return parsed ? mergeConfigInstructions(config, parsed) : config;
    },
    { profile: null, developer_instructions: '', profiles: {} }
  );
  return getDeveloperInstructions(mergedConfig);
}

module.exports = {
  readConfigDeveloperInstructions
};
