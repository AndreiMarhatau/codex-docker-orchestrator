import { Box, Stack, Typography } from '@mui/material';
import { formatLogEntry, formatLogSummary } from '../../../../log-helpers.js';

function RunEntries({ entries, emptyEntriesMessage }) {
  return (
    <Box component="details" className="run-section-card run-section-card--log" open={entries.length <= 2}>
      <summary className="log-summary">
        <span>Activity log</span>
        <span className="log-meta">{entries.length}</span>
      </summary>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {entries.length === 0 && (
          <Typography color="text.secondary">{emptyEntriesMessage || 'No logs yet.'}</Typography>
        )}
        {entries.map((entry) => (
          <Box key={entry.id} className="log-stream-item">
            <Box className="log-stream-head">
              <span className="mono">{formatLogSummary(entry)}</span>
            </Box>
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
