import { Box, Stack, Typography } from '@mui/material';

function RunAgentMessages({ agentMessages, runId }) {
  return (
    <Box className="run-section-card run-section-card--messages">
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
          <Typography variant="subtitle2">Agent messages</Typography>
          <Typography color="text.secondary" variant="caption">
            {agentMessages.length}
          </Typography>
        </Stack>
        {agentMessages.map((message, index) => (
          <Box key={`${runId}-agent-message-${index}`} className="log-box log-box--full agent-message-item">
            <pre>{message}</pre>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default RunAgentMessages;
