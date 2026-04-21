import { Box, Stack, Typography } from '@mui/material';
import DisclosureSection from '../../../../components/DisclosureSection.jsx';
import { formatLogEntry, formatLogSummary } from '../../../../log-helpers.js';

function RunEntries({ entries, emptyEntriesMessage }) {
  const logEntries = Array.isArray(entries) ? entries : [];

  return (
    <DisclosureSection
      className="run-section-card run-section-card--timeline"
      title="Raw event log"
      meta={`${logEntries.length}`}
    >
      {logEntries.length === 0 && (
        <Box className="run-empty-note">
          <Typography color="text.secondary">{emptyEntriesMessage || 'No logs yet.'}</Typography>
        </Box>
      )}
      {logEntries.length > 0 && (
        <Stack spacing={1}>
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
      )}
    </DisclosureSection>
  );
}

export default RunEntries;
