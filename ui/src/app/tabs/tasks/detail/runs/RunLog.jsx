import { Box, Stack, Typography } from '@mui/material';
import { formatDuration, formatTimestamp } from '../../../../formatters.js';
import { buildTimeline } from '../../../../log-helpers.js';
import { getRunDurationMs } from '../../../../task-helpers.js';
import RunAgentMessages from './RunAgentMessages.jsx';
import RunRequest from './RunRequest.jsx';

function RunLog({ now, run, runIndex }) {
  const entries = run.entries || [];
  const timeline = buildTimeline(entries);
  const durationMs = getRunDurationMs(run, now);

  return (
    <Box className="run-shell">
      <Stack direction="row" spacing={1} alignItems="center" className="run-shell-header">
        <Typography className="run-shell-title">{`Run #${runIndex + 1}`}</Typography>
        <Typography className="run-shell-time">{formatTimestamp(run.startedAt)}</Typography>
        {durationMs ? (
          <span className="task-runtime-pill task-runtime-pill--run">
            {formatDuration(durationMs)}
          </span>
        ) : null}
      </Stack>
      <Stack spacing={1} className="run-thread">
        <RunRequest run={run} />
        <RunAgentMessages runId={run.runId} timeline={timeline} />
      </Stack>
    </Box>
  );
}

export default RunLog;
