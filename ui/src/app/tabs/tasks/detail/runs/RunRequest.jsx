import { Box, Chip, Stack } from '@mui/material';
import { formatEffortDisplay, formatModelDisplay } from '../../../../model-helpers.js';

function RunRequest({ run }) {
  return (
    <Box component="details" className="log-entry" open>
      <summary className="log-summary">
        <span>Request</span>
        <span className="log-meta">{run.runId}</span>
      </summary>
      {(run.model || run.reasoningEffort) && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Chip size="small" label={`model: ${formatModelDisplay(run.model)}`} />
          <Chip size="small" label={`effort: ${formatEffortDisplay(run.reasoningEffort)}`} />
        </Stack>
      )}
      <Box className="log-box">
        <pre>{run.prompt || 'unknown'}</pre>
      </Box>
    </Box>
  );
}

export default RunRequest;
