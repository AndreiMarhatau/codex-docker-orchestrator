/* eslint-disable max-lines */
import { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

function RunningDurationChip({ task, now }) {
  if (task.status !== 'running' && task.status !== 'stopping') {
    return null;
  }
  const latestRun = getLatestRun(task);
  const durationMs = getElapsedMs(latestRun?.startedAt || task.createdAt, null, now);
  if (durationMs === null) {
    return null;
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<AccessTimeIcon fontSize="small" />}
      label={formatDuration(durationMs)}
    />
  );
}

function ArtifactChip({ task }) {
  const artifactCount = (task.runs || []).reduce(
    (count, run) => count + ((run.artifacts || []).length || 0),
    0
  );

  if (artifactCount <= 0) {
    return null;
  }

  return <Chip size="small" label={`outputs ${artifactCount}`} />;
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
        spacing={1}
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
          <Card
            key={task.taskId}
            className={`task-card task-card--interactive${task.taskId === selectedTaskId ? ' task-card--selected' : ''}`}
            onClick={() => setSelectedTaskId(task.taskId)}
          >
            <CardContent className="task-card-content">
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Stack spacing={0.65}>
                    <Typography className="task-card-title">
                      {task.branchName}
                    </Typography>
                    <Typography className="task-card-repo">
                      {formatRepoDisplay(task.repoUrl) || task.repoUrl}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusPill status={task.status} />
                    <GitStatusPill gitStatus={task.gitStatus} />
                    <GitDiffStats gitStatus={task.gitStatus} />
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`ref ${task.ref}`} />
                  {(task.model || task.reasoningEffort) && (
                    <Chip size="small" label={`model ${formatModelDisplay(task.model)}`} />
                  )}
                  {(task.model || task.reasoningEffort) && (
                    <Chip size="small" label={`effort ${formatEffortDisplay(task.reasoningEffort)}`} />
                  )}
                  <Chip size="small" label={`created ${formatTimestamp(task.createdAt)}`} />
                  <ArtifactChip task={task} />
                  <RunningDurationChip task={task} now={now} />
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography color="text.secondary" variant="body2">
                    {task.threadId ? `Thread ${task.threadId}` : 'Thread pending'}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
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
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
