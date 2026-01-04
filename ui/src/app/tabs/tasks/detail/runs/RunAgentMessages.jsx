import { Box } from '@mui/material';

function RunAgentMessages({ agentMessages, runId }) {
  return (
    <Box component="details" className="log-entry" open>
      <summary className="log-summary">
        <span>Agent messages</span>
        <span className="log-meta">{runId}</span>
      </summary>
      <Box className="log-box log-box--full">
        <pre>{agentMessages}</pre>
      </Box>
    </Box>
  );
}

export default RunAgentMessages;
