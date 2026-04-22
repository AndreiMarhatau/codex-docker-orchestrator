import { Box, Stack, Typography } from '@mui/material';
import { formatTimestamp } from '../../../formatters.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import { GitDiffStats, GitStatusPill, StatusPill } from '../TaskStatusPrimitives.jsx';

function DetailMetaItem({ label, value }) {
  return (
    <Stack spacing={0.35} className="task-detail-meta-item">
      <Typography className="task-detail-meta-label">{label}</Typography>
      {value}
    </Stack>
  );
}

function TaskDetailSummaryCard({ taskDetail }) {
  if (!taskDetail) {
    return null;
  }

  return (
    <Box className="task-detail-summary-card">
      <Box className="task-detail-meta-grid">
        <DetailMetaItem
          label="Environment"
          value={(
            <Typography className="task-detail-meta-value">
              {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
            </Typography>
          )}
        />
        <DetailMetaItem
          label="Branch"
          value={<Typography className="task-detail-meta-value">{taskDetail.branchName}</Typography>}
        />
        <DetailMetaItem
          label="Original ref"
          value={<Typography className="task-detail-meta-value">{taskDetail.ref || 'main'}</Typography>}
        />
        <DetailMetaItem
          label="Created"
          value={<Typography className="task-detail-meta-value">{formatTimestamp(taskDetail.createdAt)}</Typography>}
        />
        <DetailMetaItem label="Status" value={<StatusPill status={taskDetail.status} />} />
        <DetailMetaItem
          label="Git status"
          value={<GitStatusPill gitStatus={taskDetail.gitStatus} withTooltip={false} />}
        />
        <DetailMetaItem label="Changes" value={<GitDiffStats gitStatus={taskDetail.gitStatus} />} />
      </Box>
    </Box>
  );
}

export default TaskDetailSummaryCard;
