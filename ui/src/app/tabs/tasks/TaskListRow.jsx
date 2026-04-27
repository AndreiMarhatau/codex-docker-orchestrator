import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import { formatDuration } from '../../formatters.js';
import { formatRepoDisplay } from '../../repo-helpers.js';
import { getTaskRuntimeMs } from '../../task-helpers.js';
import { GitDiffStats, GitStatusPill, StatusPill } from './TaskStatusPrimitives.jsx';
const desktopSummarySx = {
  gridColumn: '1 / span 5',
  display: 'grid',
  gridTemplateColumns: '1.8fr 1.8fr 1.2fr 1.4fr 1fr',
  gap: '16px',
  alignItems: 'center',
  minWidth: 0,
  cursor: 'pointer',
  outline: 'none',
  '&:focus-visible': {
    outline: '2px solid var(--ui-accent)',
    outlineOffset: '4px',
    borderRadius: '10px'
  }
};
const mobileSummarySx = {
  flex: 1,
  minWidth: 0,
  cursor: 'pointer',
  outline: 'none',
  '&:focus-visible': {
    outline: '2px solid var(--ui-accent)',
    outlineOffset: '4px',
    borderRadius: '10px'
  }
};

function getSummaryButtonProps(setSelectedTaskId, task, loading = false) {
  const openTask = () => {
    if (!loading) {
      setSelectedTaskId(task.taskId);
    }
  };

  return {
    role: 'button',
    tabIndex: loading ? -1 : 0,
    'aria-disabled': loading ? 'true' : undefined,
    'aria-label': `Open task ${task.taskId}`,
    onClick: openTask,
    onKeyDown: (event) => {
      if (loading || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }
      event.preventDefault();
      openTask();
    }
  };
}

function TaskActionButton({ handleStopTask, loading, task }) {
  if (task.status !== 'running' && task.status !== 'reviewing') {
    return null;
  }
  return (
    <Button
      className="task-inline-action"
      size="small"
      variant="outlined"
      startIcon={<StopOutlinedIcon fontSize="small" />}
      onClick={() => handleStopTask(task.taskId)}
      disabled={loading}
    >
      Stop
    </Button>
  );
}

function TaskRuntimePill({ task, now }) {
  const runtimeMs = getTaskRuntimeMs(task, now);
  if (!runtimeMs || (task.status !== 'running' && task.status !== 'stopping')) {
    return null;
  }
  return <span className="task-runtime-pill" aria-label={`Task duration ${formatDuration(runtimeMs)}`}>{formatDuration(runtimeMs)}</span>;
}

function TaskRowActions({ handleDeleteTask, handleStopTask, loading, task }) {
  const stopEventPropagation = (event) => {
    event.stopPropagation();
  };

  const deleteTask = (event) => {
    stopEventPropagation(event);
    handleDeleteTask(task);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
      <TaskActionButton handleStopTask={handleStopTask} loading={loading} task={task} />
      <IconButton
        className="task-delete-button"
        size="small"
        onClick={deleteTask}
        onMouseDown={stopEventPropagation}
        onPointerDown={stopEventPropagation}
        disabled={loading}
        aria-label={`Remove task ${task.taskId}`}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function DesktopTaskSummary({ loading, now, repoLabel, setSelectedTaskId, task }) {
  return (
    <Box {...getSummaryButtonProps(setSelectedTaskId, task, loading)} sx={{ ...desktopSummarySx, cursor: loading ? 'default' : desktopSummarySx.cursor }}>
      <Box className="task-table-cell task-table-cell--environment">
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <GitHubIcon className="task-repo-icon" fontSize="small" />
          <Typography className="task-environment-name" title={repoLabel}>
            {repoLabel}
          </Typography>
        </Stack>
      </Box>
      <Box className="task-table-cell">
        <Typography className="task-branch-label">{task.branchName}</Typography>
      </Box>
      <Box className="task-table-cell">
        <Stack spacing={0.55} alignItems="flex-start"><StatusPill status={task.status} /><TaskRuntimePill task={task} now={now} /></Stack>
      </Box>
      <Box className="task-table-cell"><GitStatusPill gitStatus={task.gitStatus} /></Box>
      <Box className="task-table-cell"><GitDiffStats gitStatus={task.gitStatus} /></Box>
    </Box>
  );
}

function DesktopTaskRow({ handleDeleteTask, handleStopTask, loading, now, selectedTaskId, setSelectedTaskId, task }) {
  const repoLabel = formatRepoDisplay(task.repoUrl) || task.repoUrl;
  return (
    <Box className={`task-table-row${task.taskId === selectedTaskId ? ' is-selected' : ''}`} sx={{ cursor: 'default' }}>
      <DesktopTaskSummary loading={loading} now={now} repoLabel={repoLabel} setSelectedTaskId={setSelectedTaskId} task={task} />
      <Box className="task-table-cell task-table-cell--actions">
        <TaskRowActions handleDeleteTask={handleDeleteTask} handleStopTask={handleStopTask} loading={loading} task={task} />
      </Box>
    </Box>
  );
}

function MobileTaskSummary({ loading, now, repoLabel, setSelectedTaskId, task }) {
  return (
    <Box {...getSummaryButtonProps(setSelectedTaskId, task, loading)} sx={{ ...mobileSummarySx, cursor: loading ? 'default' : mobileSummarySx.cursor }}>
      <Stack spacing={1.2}>
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <GitHubIcon className="task-repo-icon" fontSize="small" />
            <Typography className="task-environment-name" title={repoLabel}>
              {repoLabel}
            </Typography>
          </Stack>
          <Typography className="task-branch-label task-branch-label--mobile">
            {task.branchName}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center"><StatusPill status={task.status} /><TaskRuntimePill task={task} now={now} /><GitStatusPill gitStatus={task.gitStatus} /><GitDiffStats gitStatus={task.gitStatus} /></Stack>
      </Stack>
    </Box>
  );
}

function MobileTaskCard({ handleDeleteTask, handleStopTask, loading, now, selectedTaskId, setSelectedTaskId, task }) {
  const repoLabel = formatRepoDisplay(task.repoUrl) || task.repoUrl;
  return (
    <Box className={`task-mobile-card${task.taskId === selectedTaskId ? ' is-selected' : ''}`} sx={{ cursor: 'default' }}>
      <Stack direction="row" spacing={1.1} justifyContent="space-between" alignItems="flex-start">
        <MobileTaskSummary loading={loading} now={now} repoLabel={repoLabel} setSelectedTaskId={setSelectedTaskId} task={task} />
        <TaskRowActions handleDeleteTask={handleDeleteTask} handleStopTask={handleStopTask} loading={loading} task={task} />
      </Stack>
    </Box>
  );
}
export { DesktopTaskRow, MobileTaskCard };
