import { Box, Chip, Stack, Typography } from '@mui/material';
import { formatEffortDisplay, formatModelDisplay } from '../../../../model-helpers.js';

function RunRequest({ run }) {
  return (
    <Box className="run-section-card run-section-card--request">
      <Stack spacing={1}>
        <Typography variant="subtitle2">Request</Typography>
      {(run.model || run.reasoningEffort) && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`model: ${formatModelDisplay(run.model)}`} />
          <Chip size="small" label={`effort: ${formatEffortDisplay(run.reasoningEffort)}`} />
        </Stack>
      )}
      <Box className="log-box log-box--full">
        <pre>{run.prompt || 'unknown'}</pre>
      </Box>
      </Stack>
    </Box>
  );
}

export default RunRequest;
