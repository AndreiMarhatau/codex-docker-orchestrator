import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StatusIcon from '../../../components/StatusIcon.jsx';
import { STATUS_CONFIG } from '../../../constants.js';
import { formatDuration } from '../../../formatters.js';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { getElapsedMs, getLatestRun } from '../../../task-helpers.js';

function TaskDetailHeader({ tasksState }) {
  const { detail, gitStatusDisplay, now } = tasksState;
  const taskDetail = detail.taskDetail;

  const GitIcon = gitStatusDisplay?.icon;

  return (
    <>
      <Tooltip title={taskDetail.repoUrl || ''}>
        <Typography color="text.secondary" variant="body2">
          {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
        </Typography>
      </Tooltip>
      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <StatusIcon status={taskDetail.status} />
        <Chip label={`ref: ${taskDetail.ref}`} size="small" />
        <Chip label={`model: ${formatModelDisplay(taskDetail.model)}`} size="small" />
        <Chip label={`effort: ${formatEffortDisplay(taskDetail.reasoningEffort)}`} size="small" />
        <Chip label={`thread: ${taskDetail.threadId || 'pending'}`} size="small" />
        {(taskDetail.status === 'running' || taskDetail.status === 'stopping') &&
          (() => {
            const latestRun = getLatestRun(taskDetail);
            const durationMs = getElapsedMs(
              latestRun?.startedAt || taskDetail.createdAt,
              null,
              now
            );
            if (durationMs === null) {
              return null;
            }
            const statusLabel =
              STATUS_CONFIG[taskDetail.status]?.label.toLowerCase() || 'running';
            return (
              <Chip
                size="small"
                variant="outlined"
                icon={<AccessTimeIcon fontSize="small" />}
                label={`${statusLabel} ${formatDuration(durationMs)}`}
              />
            );
          })()}
        {gitStatusDisplay && GitIcon && (
          <Tooltip title={gitStatusDisplay.tooltip}>
            <Chip
              icon={<GitIcon fontSize="small" />}
              label={gitStatusDisplay.label}
              size="small"
              color={gitStatusDisplay.color}
              variant="outlined"
            />
          </Tooltip>
        )}
      </Stack>
      {taskDetail.contextRepos?.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Reference repos (read-only)</Typography>
          <Stack spacing={1}>
            {taskDetail.contextRepos.map((repo, index) => (
              <Stack
                key={`${repo.envId || repo.repoUrl || 'repo'}-${index}`}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{ flexWrap: 'wrap' }}
              >
                <Typography color="text.secondary">
                  {formatRepoDisplay(repo.repoUrl) || repo.repoUrl || repo.envId}
                </Typography>
                <Chip size="small" label={`ref: ${repo.ref || 'default'}`} />
                {repo.worktreePath && (
                  <Typography className="mono" color="text.secondary">
                    {repo.worktreePath}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </>
  );
}

export default TaskDetailHeader;
