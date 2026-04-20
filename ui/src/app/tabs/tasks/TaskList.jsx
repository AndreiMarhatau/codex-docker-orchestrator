/* eslint-disable max-lines */
import { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import { STATUS_CONFIG } from '../../constants.js';
import { formatDuration, formatTimestamp } from '../../formatters.js';
import { getGitStatusDisplay } from '../../git-helpers.js';
import { formatEffortDisplay, formatModelDisplay } from '../../model-helpers.js';
import { formatRepoDisplay } from '../../repo-helpers.js';
import { getElapsedMs, getLatestRun } from '../../task-helpers.js';

function GitStatusPill({ gitStatus }) {
  const gitStatusDisplay = getGitStatusDisplay(gitStatus);
  const GitIcon = gitStatusDisplay?.icon;
  if (!gitStatusDisplay || !GitIcon) {
    return null;
  }
  return (
    <Tooltip title={gitStatusDisplay.tooltip}>
      <Box className={`git-state-pill git-state-pill--${gitStatusDisplay.tone || 'unknown'}`}>
        <GitIcon fontSize="inherit" />
        <span>{gitStatusDisplay.label}</span>
      </Box>
    </Tooltip>
  );
}

function GitDiffStats({ gitStatus }) {
  const additions = gitStatus?.diffStats?.additions ?? 0;
  const deletions = gitStatus?.diffStats?.deletions ?? 0;
  if (!additions && !deletions) {
    return null;
  }
  return (
    <Tooltip title={`Diff since base commit: +${additions} / -${deletions}`}>
      <Box className="task-diff-stats">
        {additions > 0 && <span className="diff-add">+{additions}</span>}
        {deletions > 0 && <span className="diff-del">-{deletions}</span>}
      </Box>
    </Tooltip>
  );
}

function MetaLabel({ children }) {
  return (
    <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
      {children}
    </Box>
  );
}

function StatusPill({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <Box className={`status-pill status-pill--${status || 'unknown'}`}>
      <span className="status-pill-dot" style={{ backgroundColor: config.border }} />
      <span>{config.label}</span>
    </Box>
  );
}

function countTaskArtifacts(task) {
  return (task.runs || []).reduce((count, run) => count + ((run.artifacts || []).length || 0), 0);
}

function TaskRowHeader({ task }) {
  return (
    <Stack
      spacing={1}
      alignItems="flex-start"
    >
      <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
        <Typography className="task-card-title" sx={{ overflowWrap: 'anywhere' }}>
          {task.branchName}
        </Typography>
        <Typography className="task-card-repo" sx={{ overflowWrap: 'anywhere' }}>
          {formatRepoDisplay(task.repoUrl) || task.repoUrl}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <StatusPill status={task.status} />
        <GitStatusPill gitStatus={task.gitStatus} />
        <GitDiffStats gitStatus={task.gitStatus} />
      </Stack>
    </Stack>
  );
}

function TaskRowSummary({ artifactCount, elapsedLabel, task }) {
  return (
    <Stack spacing={0.35}>
      <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: 'anywhere', lineHeight: 1.45 }}>
        <MetaLabel>Ref</MetaLabel> {task.ref}
        <Box component="span" sx={{ mx: 0.75 }}>
          ·
        </Box>
        <MetaLabel>Created</MetaLabel> {formatTimestamp(task.createdAt)}
        {(task.model || task.reasoningEffort) && (
          <>
            <Box component="span" sx={{ mx: 0.75 }}>
              ·
            </Box>
            <MetaLabel>Model</MetaLabel> {formatModelDisplay(task.model)}
            <Box component="span" sx={{ mx: 0.75 }}>
              ·
            </Box>
            <MetaLabel>Effort</MetaLabel> {formatEffortDisplay(task.reasoningEffort)}
          </>
        )}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: 'anywhere', lineHeight: 1.45 }}>
        <MetaLabel>Thread</MetaLabel> {task.threadId ? `#${task.threadId}` : 'pending'}
        {(artifactCount > 0 || elapsedLabel) && (
          <>
            <Box component="span" sx={{ mx: 0.75 }}>
              ·
            </Box>
            {artifactCount > 0 && (
              <>
                <MetaLabel>Outputs</MetaLabel> {artifactCount}
                {elapsedLabel && (
                  <Box component="span" sx={{ mx: 0.75 }}>
                    ·
                  </Box>
                )}
              </>
            )}
            {elapsedLabel && (
              <>
                <MetaLabel>Elapsed</MetaLabel> {elapsedLabel}
              </>
            )}
          </>
        )}
      </Typography>
    </Stack>
  );
}

function TaskRowActions({ handleDeleteTask, handleStopTask, loading, task }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      justifyContent="flex-end"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      <Tooltip title="Stop task">
        <span>
          <IconButton
            size="small"
            color="error"
            onClick={(event) => {
              event.stopPropagation();
              handleStopTask(task.taskId);
            }}
            disabled={loading || task.status !== 'running'}
            aria-label={`Stop task ${task.taskId}`}
          >
            <StopCircleOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Remove task">
        <span>
          <IconButton
            size="small"
            color="secondary"
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteTask(task.taskId);
            }}
            disabled={loading}
            aria-label={`Remove task ${task.taskId}`}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

function TaskRow({ handleDeleteTask, handleStopTask, now, selectedTaskId, setSelectedTaskId, task, loading }) {
  const artifactCount = countTaskArtifacts(task);
  const isActiveTask = task.status === 'running' || task.status === 'stopping';
  const latestRun = isActiveTask ? getLatestRun(task) : null;
  const elapsedLabel = isActiveTask
    ? formatDuration(getElapsedMs(latestRun?.startedAt || task.createdAt, null, now))
    : null;

  return (
    <Card
      className={`task-card task-card--interactive${task.taskId === selectedTaskId ? ' task-card--selected' : ''}`}
      onClick={() => setSelectedTaskId(task.taskId)}
    >
      <CardContent className="task-card-content">
        <Stack spacing={1.5}>
          <TaskRowHeader task={task} />
          <TaskRowSummary artifactCount={artifactCount} elapsedLabel={elapsedLabel} task={task} />
          <TaskRowActions
            handleDeleteTask={handleDeleteTask}
            handleStopTask={handleStopTask}
            loading={loading}
            task={task}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

function TaskList({
  data,
  handleDeleteTask,
  handleStopTask,
  now,
  selectedTaskId,
  setSelectedTaskId,
  visibleTasks
}) {
  const { loading } = data;
  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <Typography variant="h6" className="panel-title">
          Tasks
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Open a task to inspect live output, artifacts, and git changes.
        </Typography>
      </Stack>
      <Stack spacing={1.5}>
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.taskId}
            handleDeleteTask={handleDeleteTask}
            handleStopTask={handleStopTask}
            loading={loading}
            now={now}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            task={task}
          />
        ))}
        {visibleTasks.length === 0 && (
          <Box className="empty-state">
            <Typography color="text.secondary">
              No tasks yet. Create one to get started.
            </Typography>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
export default memo(TaskList);
