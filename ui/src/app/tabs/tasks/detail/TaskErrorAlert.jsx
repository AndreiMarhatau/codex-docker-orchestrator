import { Alert, AlertTitle } from '@mui/material';

function TaskErrorAlert({ taskDetail }) {
  const runLogs = Array.isArray(taskDetail.runLogs) ? taskDetail.runLogs : [];
  const latestRunLog = runLogs[runLogs.length - 1] || null;
  const latestRunFailedBeforeSpawn = latestRunLog?.failedBeforeSpawn === true;
  const hasTaskError = Boolean(taskDetail.error);
  const isPreSpawnFailure =
    taskDetail.status === 'failed' && hasTaskError && latestRunFailedBeforeSpawn;
  const showTaskError =
    hasTaskError && (taskDetail.status === 'failed' || taskDetail.status === 'stopped');

  if (!showTaskError) {
    return null;
  }

  return (
    <Alert severity={taskDetail.status === 'stopped' ? 'info' : 'error'} variant="outlined">
      <AlertTitle>
        {isPreSpawnFailure
          ? 'Startup failed before codex-docker spawned'
          : taskDetail.status === 'stopped'
            ? 'Task stopped'
            : 'Task failed'}
      </AlertTitle>
      {taskDetail.error}
    </Alert>
  );
}

export default TaskErrorAlert;
