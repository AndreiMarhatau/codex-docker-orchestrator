/* eslint-disable max-lines */
import { Alert, AlertTitle, Box, Stack, Tooltip, Typography } from '@mui/material';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { STATUS_CONFIG } from '../../../constants.js';
import { formatDuration, formatTimestamp } from '../../../formatters.js';
import { getGitStatusDisplay } from '../../../git-helpers.js';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { getElapsedMs, getLatestRun } from '../../../task-helpers.js';
import WorkspaceHeader from '../../../components/WorkspaceHeader.jsx';
import TaskDetailCollections from './TaskDetailCollections.jsx';

const GIT_ICON_MAP = {
  clean: CheckCircleOutlineIcon,
  dirty: EditNoteOutlinedIcon,
  pushed: CloudDoneOutlinedIcon,
  unpushed: CloudUploadOutlinedIcon,
  unknown: HelpOutlineIcon
};

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

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

function RunningDurationLabel({ now, taskDetail }) {
  if (taskDetail.status !== 'running' && taskDetail.status !== 'stopping') {
    return null;
  }
  const latestRun = getLatestRun(taskDetail);
  const durationMs = getElapsedMs(latestRun?.startedAt || taskDetail.createdAt, null, now);
  if (durationMs === null) {
    return null;
  }

  return `Live ${formatDuration(durationMs)}`;
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

function DetailMeta({ items }) {
  return (
    <Box className="detail-meta-inline">
      {items.filter(Boolean).map((item) => (
        <span key={item} className="detail-meta-inline-item">{item}</span>
      ))}
    </Box>
  );
}

function TaskDetailHeader({ tasksState }) {
  const { detail, now } = tasksState;
  const taskDetail = detail.taskDetail;
  const generatedArtifactCount = (taskDetail.runLogs || []).reduce(
    (count, run) => count + (run.artifacts || []).length,
    0
  );
  const attachmentCount = (taskDetail.attachments || []).length;
  const contextRepoCount = (taskDetail.contextRepos || []).length;
  const hasRunLogs = (taskDetail.runLogs || []).length > 0;
  const showTaskContextDetails = !hasRunLogs && (attachmentCount > 0 || contextRepoCount > 0);
  const liveLabel = RunningDurationLabel({ now, taskDetail });

  return (
    <Stack spacing={1.5}>
      <WorkspaceHeader
        eyebrow={formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
        title={taskDetail.branchName}
        actions={(
          <Stack spacing={0.75} className="workspace-header-side">
            <Typography className="workspace-side-meta" color="text.secondary" variant="body2">
              {`Created ${formatTimestamp(taskDetail.createdAt)}`}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <StatusPill status={taskDetail.status} />
              <GitStatusPill gitStatus={taskDetail.gitStatus} />
            </Stack>
          </Stack>
        )}
        meta={(
          <DetailMeta
            items={[
              `ref ${taskDetail.ref}`,
              `model ${formatModelDisplay(taskDetail.model)}`,
              `effort ${formatEffortDisplay(taskDetail.reasoningEffort)}`,
              `thread ${taskDetail.threadId || 'pending'}`,
              formatCount(generatedArtifactCount, 'output'),
              formatCount(attachmentCount, 'file'),
              formatCount(contextRepoCount, 'repo'),
              liveLabel
            ]}
          />
        )}
      />

      <TaskErrorAlert taskDetail={taskDetail} />
      {showTaskContextDetails ? (
        <TaskDetailCollections taskDetail={taskDetail} includeOutputs={false} onlyNonEmpty />
      ) : null}
    </Stack>
  );
}

export default TaskDetailHeader;
