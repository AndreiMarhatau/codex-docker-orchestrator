const { readJson, removePath } = require('../../../../shared/filesystem/storage');
const { withTaskMutationClaim } = require('../mutation-claim');
const { cleanupContextRepos, removeWorktree } = require('./worktrees');

function attachDeleteTaskMethod(Orchestrator) {
  Orchestrator.prototype.deleteTask = async function deleteTask(taskId) {
    return withTaskMutationClaim(this, taskId, null, async () => {
      await this.init();
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
      const env = await this.readEnv(meta.envId);
      const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
      await this.ensureOwnership(meta.worktreePath);
      await this.ensureOwnership(this.taskDir(taskId));
      await cleanupContextRepos(this, contextRepos);
      await removeWorktree({
        exec: this.exec.bind(this),
        mirrorPath: env.mirrorPath,
        worktreePath: meta.worktreePath
      });
      try {
        await this.removeTaskDockerSidecar(taskId);
      } catch (error) {
        // Best-effort: task deletion should proceed even if Docker cleanup fails.
      }
      await removePath(this.taskDir(taskId));
      this.notifyTasksChanged(taskId);
      return undefined;
    });
  };
}

module.exports = {
  attachDeleteTaskMethod,
  cleanupContextRepos
};
