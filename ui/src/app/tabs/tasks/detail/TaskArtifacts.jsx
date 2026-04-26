import { Box, Stack, Typography } from '@mui/material';
import { formatDuration, formatTimestamp } from '../../../formatters.js';
import { getRunDurationMs } from '../../../task-helpers.js';
import RunArtifacts from './runs/RunArtifacts.jsx';

function TaskArtifacts({ tasksState }) {
  const { detail, now } = tasksState;
  const taskDetail = detail.taskDetail;
  const runLogs = taskDetail.runLogs || [];
  const runsWithArtifacts = runLogs
    .map((run, index) => ({ index, run }))
    .filter(({ run }) => (run.artifacts || []).length > 0);

  return (
    <Box className="detail-section detail-section--artifacts">
      <Stack spacing={1.1}>
        <Typography variant="h6" className="detail-section-title">Artifacts</Typography>
        {runsWithArtifacts.map(({ index, run }) => {
          const durationMs = getRunDurationMs(run, now);
          return (
            <Box className="run-shell" key={run.runId}>
              <Stack direction="row" spacing={1} alignItems="center" className="run-shell-header">
                <Typography className="run-shell-title">{`Run #${index + 1}`}</Typography>
                <Typography className="run-shell-time">{formatTimestamp(run.startedAt)}</Typography>
                {durationMs ? (
                  <span className="task-runtime-pill task-runtime-pill--run">
                    {formatDuration(durationMs)}
                  </span>
                ) : null}
              </Stack>
              <RunArtifacts defaultOpen run={run} taskId={taskDetail.taskId} />
            </Box>
          );
        })}
        {runsWithArtifacts.length === 0 && (
          <Typography color="text.secondary">No artifacts yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}

export default TaskArtifacts;
