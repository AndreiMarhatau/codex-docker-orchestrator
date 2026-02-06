import { Box, Stack } from '@mui/material';

function RunAgentMessages({ agentMessages, runId }) {
  return (
    <Box component="details" className="log-entry" open>
      <summary className="log-summary">
        <span>Agent messages</span>
        <span className="log-meta">{runId}</span>
      </summary>
      <Stack spacing={1} sx={{ mt: 1 }}>
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
