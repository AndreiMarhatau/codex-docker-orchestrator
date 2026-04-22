import { Box, Stack, Typography } from '@mui/material';
import { formatTimestamp } from '../../../../formatters.js';
import { buildTimeline } from '../../../../log-helpers.js';
import RunAgentMessages from './RunAgentMessages.jsx';
import RunArtifacts from './RunArtifacts.jsx';
import RunRequest from './RunRequest.jsx';

function RunLog({ run, runIndex, taskId }) {
  const entries = run.entries || [];
  const timeline = buildTimeline(entries);

  return (
    <Box className="run-shell">
      <Stack direction="row" spacing={1} alignItems="center" className="run-shell-header">
        <Typography className="run-shell-title">{`Run #${runIndex + 1}`}</Typography>
        <Typography className="run-shell-time">{formatTimestamp(run.startedAt)}</Typography>
      </Stack>
      <Stack spacing={1} className="run-thread">
        <RunRequest run={run} />
        <RunAgentMessages runId={run.runId} timeline={timeline} />
        <RunArtifacts run={run} taskId={taskId} />
      </Stack>
    </Box>
  );
}

export default RunLog;
