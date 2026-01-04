const path = require('node:path');
const { ensureDir } = require('../storage');
const { repoNameFromUrl } = require('./utils');

function attachPathMethods(Orchestrator) {
  Orchestrator.prototype.envsDir = function envsDir() {
    return path.join(this.orchHome, 'envs');
  };

  Orchestrator.prototype.tasksDir = function tasksDir() {
    return path.join(this.orchHome, 'tasks');
  };

  Orchestrator.prototype.envDir = function envDir(envId) {
    return path.join(this.envsDir(), envId);
  };

  Orchestrator.prototype.uploadsDir = function uploadsDir() {
    return path.join(this.orchHome, 'uploads');
  };

  Orchestrator.prototype.mirrorDir = function mirrorDir(envId) {
    return path.join(this.envDir(envId), 'mirror');
  };

  Orchestrator.prototype.taskDir = function taskDir(taskId) {
    return path.join(this.tasksDir(), taskId);
  };

  Orchestrator.prototype.taskWorktree = function taskWorktree(taskId, repoUrl) {
    const repoName = repoNameFromUrl(repoUrl);
    return path.join(this.taskDir(taskId), repoName);
  };

  Orchestrator.prototype.taskContextDir = function taskContextDir(taskId) {
    return path.join(this.taskDir(taskId), 'context');
  };

  Orchestrator.prototype.taskAttachmentsDir = function taskAttachmentsDir(taskId) {
    return path.join(this.taskDir(taskId), 'attachments');
  };

  Orchestrator.prototype.taskContextWorktree = function taskContextWorktree(
    taskId,
    repoUrl,
    envId
  ) {
    const repoName = repoNameFromUrl(repoUrl);
    const suffix = envId ? `-${envId}` : '';
    return path.join(this.taskContextDir(taskId), `${repoName}${suffix}`);
  };

  Orchestrator.prototype.taskArtifactsDir = function taskArtifactsDir(taskId) {
    return path.join(this.taskDir(taskId), 'artifacts');
  };

  Orchestrator.prototype.runArtifactsDir = function runArtifactsDir(taskId, runLabel) {
    return path.join(this.taskArtifactsDir(taskId), runLabel);
  };

  Orchestrator.prototype.taskMetaPath = function taskMetaPath(taskId) {
    return path.join(this.taskDir(taskId), 'meta.json');
  };

  Orchestrator.prototype.taskLogsDir = function taskLogsDir(taskId) {
    return path.join(this.taskDir(taskId), 'logs');
  };

  Orchestrator.prototype.envRepoUrlPath = function envRepoUrlPath(envId) {
    return path.join(this.envDir(envId), 'repo.url');
  };

  Orchestrator.prototype.envDefaultBranchPath = function envDefaultBranchPath(envId) {
    return path.join(this.envDir(envId), 'default_branch');
  };

  Orchestrator.prototype.init = async function init() {
    await ensureDir(this.envsDir());
    await ensureDir(this.tasksDir());
  };
}

module.exports = {
  attachPathMethods
};
