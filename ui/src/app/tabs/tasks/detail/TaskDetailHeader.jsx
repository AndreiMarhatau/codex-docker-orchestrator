import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { StatusPill } from '../TaskStatusPrimitives.jsx';

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

function TaskDetailHeader({ loading = false, tasksState }) {
  const { actions, detail, selection } = tasksState;
  const taskDetail = detail.taskDetail;
  const isRunning = taskDetail.status === 'running' || taskDetail.status === 'stopping';

  return (
    <Stack spacing={1.35} className="task-detail-header">
      <button
        type="button"
        className="task-detail-back-link"
        onClick={selection.handleBackToTasks}
        aria-label="Back to tasks"
      >
        <ArrowBackRoundedIcon fontSize="inherit" />
        Back to tasks
      </button>

      <Stack
        className="task-detail-title-row"
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Stack spacing={0.7} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component="h1" className="task-detail-title">
              {taskDetail.branchName}
            </Typography>
            <StatusPill status={taskDetail.status} />
          </Stack>
          <Stack direction="row" spacing={0.9} alignItems="center" flexWrap="wrap" useFlexGap>
            <GitHubIcon fontSize="small" className="task-repo-icon" />
            <Typography className="task-detail-subtitle">
              {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          className="task-detail-hero-actions"
        >
          {isRunning && (
            <Button
              variant="outlined"
              startIcon={<StopOutlinedIcon fontSize="small" />}
              onClick={() => actions.handleStopTask(taskDetail.taskId)}
              disabled={loading}
            >
              Stop
            </Button>
          )}
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => actions.handleDeleteTask(taskDetail.taskId)}
            disabled={loading}
          >
            Delete
          </Button>
        </Stack>
      </Stack>

      <TaskErrorAlert taskDetail={taskDetail} />
    </Stack>
  );
}

export default TaskDetailHeader;
