/* eslint-disable max-lines */
import { Alert, AlertTitle, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { STATUS_CONFIG } from '../../../constants.js';
import { formatBytes, formatDuration, formatTimestamp } from '../../../formatters.js';
import { getGitStatusDisplay } from '../../../git-helpers.js';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { getElapsedMs, getLatestRun } from '../../../task-helpers.js';

const GIT_ICON_MAP = {
  clean: CheckCircleOutlineIcon,
  dirty: EditNoteOutlinedIcon,
  pushed: CloudDoneOutlinedIcon,
  unpushed: CloudUploadOutlinedIcon,
  unknown: HelpOutlineIcon
};

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
    <Alert
      severity={taskDetail.status === 'stopped' ? 'info' : 'error'}
      variant="outlined"
      sx={{ whiteSpace: 'pre-wrap' }}
    >
      <AlertTitle>
        {isPreSpawnFailure
          ? 'Startup failed before codex-docker spawned'
          : taskDetail.status === 'stopped'
            ? 'Task stopped'
            : 'Task failed'}
      </AlertTitle>
      {taskDetail.error}
      {isPreSpawnFailure && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          No log entries were produced because startup failed before codex-docker was
          spawned.
        </Typography>
      )}
    </Alert>
  );
}

function RunningDurationChip({ now, taskDetail }) {
  if (taskDetail.status !== 'running' && taskDetail.status !== 'stopping') {
    return null;
  }
  const latestRun = getLatestRun(taskDetail);
  const durationMs = getElapsedMs(latestRun?.startedAt || taskDetail.createdAt, null, now);
  if (durationMs === null) {
    return null;
  }

  return (
    <Chip
      size="small"
      variant="outlined"
      label={`Live ${formatDuration(durationMs)}`}
    />
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

function GitStatusPill({ gitStatus }) {
  const gitStatusDisplay = getGitStatusDisplay(gitStatus);
  const GitIcon = GIT_ICON_MAP[gitStatusDisplay?.tone || 'unknown'] || HelpOutlineIcon;

  if (!gitStatusDisplay) {
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

function DetailList({ emptyLabel, items }) {
  if (items.length === 0) {
    return (
      <Box className="detail-list-empty">
        <Typography color="text.secondary">{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Box key={item.key} className="detail-list-item">
          <Stack spacing={0.5}>
            <Typography className="detail-list-title">{item.title}</Typography>
            {item.subtitle && (
              <Typography color="text.secondary" variant="body2">
                {item.subtitle}
              </Typography>
            )}
          </Stack>
          {item.meta?.length > 0 && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {item.meta.map((value) => (
                <Chip key={`${item.key}-${value}`} size="small" label={value} variant="outlined" />
              ))}
            </Stack>
          )}
          {item.path && (
            <Typography className="mono" color="text.secondary">
              {item.path}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function TaskDetailHeader({ tasksState }) {
  const { detail, now } = tasksState;
  const taskDetail = detail.taskDetail;
  const generatedArtifacts = (taskDetail.runLogs || []).flatMap((run) =>
    (run.artifacts || []).map((artifact, index) => ({
      key: `${run.runId}-${artifact.path}-${index}`,
      title: artifact.path.split('/').pop() || artifact.path,
      subtitle: `from ${run.runId}`,
      meta: [formatBytes(artifact.size)],
      path: artifact.path
    }))
  );
  const contextRepoItems = (taskDetail.contextRepos || []).map((repo, index) => ({
    key: `${repo.envId || repo.repoUrl || 'repo'}-${index}`,
    title: formatRepoDisplay(repo.repoUrl) || repo.repoUrl || repo.envId,
    subtitle: repo.ref ? `ref ${repo.ref}` : '',
    meta: repo.ref ? [`ref ${repo.ref}`] : [],
    path: repo.worktreePath || ''
  }));
  const attachmentItems = (taskDetail.attachments || []).map((file, index) => ({
    key: `${file.name || 'file'}-${index}`,
    title: file.originalName || file.name,
    subtitle: Number.isFinite(file.size) ? formatBytes(file.size) : '',
    meta: Number.isFinite(file.size) ? [formatBytes(file.size)] : [],
    path: file.path || ''
  }));

  return (
    <Stack spacing={2}>
      <Box className="task-summary-card">
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
          >
            <Stack spacing={0.85} sx={{ maxWidth: 720 }}>
              <Typography className="task-summary-label">
                {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
              </Typography>
              <Typography variant="h5" className="task-summary-title">
                {taskDetail.branchName}
              </Typography>
              <Typography color="text.secondary">
                Created {formatTimestamp(taskDetail.createdAt)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <StatusPill status={taskDetail.status} />
              <GitStatusPill gitStatus={taskDetail.gitStatus} />
              <Chip size="small" label={`ref ${taskDetail.ref}`} variant="outlined" />
              <Chip size="small" label={`model ${formatModelDisplay(taskDetail.model)}`} variant="outlined" />
              <Chip size="small" label={`effort ${formatEffortDisplay(taskDetail.reasoningEffort)}`} variant="outlined" />
              <Chip size="small" label={`thread ${taskDetail.threadId || 'pending'}`} variant="outlined" />
              <Chip
                size="small"
                label={`artifacts ${generatedArtifacts.length}`}
                variant="outlined"
              />
              <RunningDurationChip now={now} taskDetail={taskDetail} />
            </Stack>
          </Stack>

          <TaskErrorAlert taskDetail={taskDetail} />

          <Box className="detail-meta-grid">
            <Box className="detail-meta-panel">
              <Stack spacing={1.25}>
                <Typography variant="subtitle2">Reference repos</Typography>
                <DetailList
                  emptyLabel="No reference repos attached."
                  items={contextRepoItems}
                />
              </Stack>
            </Box>
            <Box className="detail-meta-panel">
              <Stack spacing={1.25}>
                <Typography variant="subtitle2">Task files</Typography>
                <DetailList
                  emptyLabel="No task files attached."
                  items={attachmentItems}
                />
              </Stack>
            </Box>
            <Box className="detail-meta-panel">
              <Stack spacing={1.25}>
                <Typography variant="subtitle2">Outputs</Typography>
                <DetailList
                  emptyLabel="No outputs generated yet."
                  items={generatedArtifacts.slice(0, 4)}
                />
                {generatedArtifacts.length > 4 && (
                  <Typography color="text.secondary" variant="body2">
                    {`${generatedArtifacts.length - 4} more outputs are available in the run artifacts below.`}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}

export default TaskDetailHeader;
