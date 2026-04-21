import { Box, Typography } from '@mui/material';

function RunRequest({ run }) {
  const prompt = typeof run.prompt === 'string' && run.prompt.trim() ? run.prompt : 'unknown';

  return (
    <Box className="run-section-card run-section-card--request run-step">
      <Typography className="run-request-text" component="div">
        <span className="run-request-highlight-shell">
          <span className="run-request-highlight">{prompt}</span>
        </span>
      </Typography>
    </Box>
  );
}

export default RunRequest;
