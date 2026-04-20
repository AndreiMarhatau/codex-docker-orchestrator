import { Box, Stack, Typography } from '@mui/material';
import { formatLogEntry, formatLogSummary } from '../../../../log-helpers.js';

function RunEntries({ entries, emptyEntriesMessage }) {
  const logEntries = Array.isArray(entries) ? entries : [];

  return (
    <Box component="details" className="run-section-card run-section-card--log">
      <summary className="log-summary">
        <span>Activity log</span>
        <span className="log-meta">{logEntries.length}</span>
      </summary>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {logEntries.length === 0 && (
          <Typography color="text.secondary">{emptyEntriesMessage || 'No logs yet.'}</Typography>
        )}
        {logEntries.map((entry, index) => (
          <Box key={entry?.id || `${entry?.type || entry?.parsed?.type || 'log'}-${index}`} className="log-stream-item">
            <Box className="log-stream-head">
              <span className="mono">{formatLogSummary(entry) || entry?.type || entry?.parsed?.type || 'log entry'}</span>
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
