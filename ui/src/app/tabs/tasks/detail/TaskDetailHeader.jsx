import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../../formatters.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { getTaskRuntimeMs } from '../../../task-helpers.js';
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

function RuntimePill({ runtimeMs }) {
  if (!runtimeMs) {
    return null;
  }

  return (
    <span
      className="task-runtime-pill task-runtime-pill--detail"
      aria-label={`Task duration ${formatDuration(runtimeMs)}`}
    >
      {formatDuration(runtimeMs)}
    </span>
  );
}

function TaskDetailHeader({ loading = false, now, tasksState }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { actions, detail, selection } = tasksState;
  const taskDetail = detail.taskDetail;
  const canStop = taskDetail.status === 'running';
  const showRuntime = taskDetail.status === 'running' || taskDetail.status === 'stopping';
  const runtimeMs = getTaskRuntimeMs(taskDetail, now);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
  const actionsMenuOpen = Boolean(actionsMenuAnchor);

  function closeActionsMenu() {
    setActionsMenuAnchor(null);
  }

  function handleStopTask() {
    closeActionsMenu();
    actions.handleStopTask(taskDetail.taskId);
  }

  function handleDeleteTask() {
    closeActionsMenu();
    actions.handleDeleteTask(taskDetail.taskId);
  }

  return (
    <Stack spacing={1.35} className="task-detail-header">
      <button
        type="button"
        className="task-detail-back-link"
        onClick={selection.handleBackToTasks}
        aria-label="Back to tasks"
      >
        <ArrowBackRoundedIcon fontSize="inherit" />
        {isMobile ? 'Back' : 'Back to tasks'}
      </button>

      <Stack
        className="task-detail-title-row"
        direction="row"
        spacing={1.5}
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Stack spacing={0.7} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component="h1" className="task-detail-title">
              {taskDetail.branchName}
            </Typography>
            <StatusPill status={taskDetail.status} />
            {showRuntime && <RuntimePill runtimeMs={runtimeMs} />}
          </Stack>
          <Stack direction="row" spacing={0.9} alignItems="center" flexWrap="wrap" useFlexGap>
            <GitHubIcon fontSize="small" className="task-repo-icon" />
            <Typography className="task-detail-subtitle">
              {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
            </Typography>
          </Stack>
        </Stack>

        {isMobile ? (
          <>
            <IconButton
              className="task-detail-mobile-menu-button"
              aria-label="Task actions"
              onClick={(event) => setActionsMenuAnchor(event.currentTarget)}
              disabled={loading}
            >
              <MoreVertRoundedIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={actionsMenuAnchor}
              open={actionsMenuOpen}
              onClose={closeActionsMenu}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            >
              {canStop && (
                <MenuItem onClick={handleStopTask} disabled={loading}>
                  Stop
                </MenuItem>
              )}
              <MenuItem onClick={handleDeleteTask} disabled={loading} sx={{ color: 'error.main' }}>
                Delete
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            className="task-detail-hero-actions"
          >
            {canStop && (
              <Button
                variant="outlined"
                startIcon={<StopOutlinedIcon fontSize="small" />}
                onClick={handleStopTask}
                disabled={loading}
              >
                Stop
              </Button>
            )}
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              onClick={handleDeleteTask}
              disabled={loading}
            >
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      <TaskErrorAlert taskDetail={taskDetail} />
    </Stack>
  );
}

export default TaskDetailHeader;
