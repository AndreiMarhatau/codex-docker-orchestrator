const crypto = require('node:crypto');
const {
  ensureDir,
  writeJson,
  writeText,
  readJson,
  readText,
  listDirs,
  removePath,
  pathExists
} = require('../storage');

async function verifyDefaultBranch({ execOrThrow, mirrorDir, defaultBranch }) {
  const refsToVerify = defaultBranch.startsWith('refs/')
    ? [defaultBranch]
    : [`refs/heads/${defaultBranch}`, `refs/remotes/origin/${defaultBranch}`];
  for (const ref of refsToVerify) {
    try {
      await execOrThrow('git', ['--git-dir', mirrorDir, 'show-ref', '--verify', ref]);
      return true;
    } catch (error) {
      // Try next ref candidate.
    }
  }
  return false;
}

function attachEnvMethods(Orchestrator) {
  function emitEnvChange(orch, envId = null) {
    if (typeof orch.emitStateEvent === 'function') {
      orch.emitStateEvent('envs_changed', envId ? { envId } : {});
    }
  }

  Orchestrator.prototype.readEnv = async function readEnv(envId) {
    const repoUrl = await readText(this.envRepoUrlPath(envId));
    const defaultBranch = await readText(this.envDefaultBranchPath(envId));
    let envVars = {};
    const envVarsPath = this.envVarsPath(envId);
    if (await pathExists(envVarsPath)) {
      const envVarsData = await readJson(envVarsPath);
      if (envVarsData && typeof envVarsData === 'object' && !Array.isArray(envVarsData)) {
        envVars = envVarsData;
      }
    }
    return {
      envId,
      repoUrl,
      defaultBranch,
      envVars,
      mirrorPath: this.mirrorDir(envId)
    };
  };

  Orchestrator.prototype.listEnvs = async function listEnvs() {
    await this.init();
    const envIds = await listDirs(this.envsDir());
    const envs = [];
    for (const envId of envIds) {
      try {
        const env = await this.readEnv(envId);
        envs.push(env);
      } catch (error) {
        continue;
      }
    }
    return envs;
  };

  Orchestrator.prototype.createEnv = async function createEnv({ repoUrl, defaultBranch, envVars }) {
    await this.init();
    const envId = crypto.randomUUID();
    const envDir = this.envDir(envId);
    const mirrorDir = this.mirrorDir(envId);
    await ensureDir(envDir);
    await writeText(this.envRepoUrlPath(envId), repoUrl);
    await writeText(this.envDefaultBranchPath(envId), defaultBranch);
    await writeJson(this.envVarsPath(envId), envVars || {});

    try {
      await this.execOrThrow('git', ['clone', '--bare', repoUrl, mirrorDir]);
      await this.execOrThrow('git', [
        '--git-dir',
        mirrorDir,
        'config',
        'remote.origin.fetch',
        '+refs/heads/*:refs/remotes/origin/*'
      ]);
      const verified = await verifyDefaultBranch({
        execOrThrow: this.execOrThrow.bind(this),
        mirrorDir,
        defaultBranch
      });
      if (!verified) {
        throw new Error(`Default branch '${defaultBranch}' not found in repository.`);
      }
      const created = { envId, repoUrl, defaultBranch, envVars: envVars || {} };
      emitEnvChange(this, envId);
      return created;
    } catch (error) {
      await removePath(envDir);
      throw error;
    }
  };

  Orchestrator.prototype.updateEnv = async function updateEnv(envId, { defaultBranch, envVars }) {
    await this.init();
    await this.ensureOwnership(this.envDir(envId));
    if (defaultBranch !== undefined) {
      const verified = await verifyDefaultBranch({
        execOrThrow: this.execOrThrow.bind(this),
        mirrorDir: this.mirrorDir(envId),
        defaultBranch
      });
      if (!verified) {
        throw new Error(`Default branch '${defaultBranch}' not found in repository.`);
      }
      await writeText(this.envDefaultBranchPath(envId), defaultBranch);
    }
    if (envVars !== undefined) {
      await writeJson(this.envVarsPath(envId), envVars);
    }
    const updated = await this.readEnv(envId);
    emitEnvChange(this, envId);
    return updated;
  };

  Orchestrator.prototype.deleteEnv = async function deleteEnv(envId) {
    await this.init();
    const tasks = await this.listTasks();
    for (const task of tasks.filter((item) => item.envId === envId)) {
      await this.deleteTask(task.taskId);
    }
    await this.ensureOwnership(this.envDir(envId));
    await removePath(this.envDir(envId));
    emitEnvChange(this, envId);
  };

  Orchestrator.prototype.envExists = async function envExists(envId) {
    return pathExists(this.envDir(envId));
  };
}

module.exports = {
  attachEnvMethods
};
