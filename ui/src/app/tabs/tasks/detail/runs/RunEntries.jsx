import { Box, Stack, Typography } from '@mui/material';
import StatusIcon from '../../../../components/StatusIcon.jsx';
import { formatDuration, formatTimestamp } from '../../../../formatters.js';
import { formatLogEntry, formatLogSummary } from '../../../../log-helpers.js';
import { getElapsedMs } from '../../../../task-helpers.js';

function RunEntries({ entries, now, run }) {
  return (
    <Box component="details" className="log-run">
      <summary className="log-summary">
        <span>{run.runId}</span>
        <Box
          component="span"
          className="log-meta"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <StatusIcon status={run.status} size="small" />
          <span>{formatTimestamp(run.startedAt)}</span>
          {(() => {
            const durationMs = getElapsedMs(run.startedAt, run.finishedAt, now);
            if (durationMs === null) {
              return null;
            }
            return <span>{formatDuration(durationMs)}</span>;
          })()}
        </Box>
      </summary>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {entries.length === 0 && (
          <Typography color="text.secondary">No logs yet.</Typography>
        )}
        {entries.map((entry) => (
          <Box key={`${run.runId}-${entry.id}`} component="details" className="log-entry">
            <summary className="log-summary">
              <span className="mono">{formatLogSummary(entry)}</span>
            </summary>
            <Box className="log-box">
              <pre>{formatLogEntry(entry)}</pre>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default RunEntries;
