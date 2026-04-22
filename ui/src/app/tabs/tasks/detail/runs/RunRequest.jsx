import { Box, Typography } from '@mui/material';

function RunRequest({ run }) {
  const prompt = typeof run.prompt === 'string' && run.prompt.trim() ? run.prompt : 'unknown';

  return (
    <Box className="run-message run-message--user">
      <Typography className="run-message-author">You</Typography>
      <Typography className="run-message-text" component="div">
        {prompt}
      </Typography>
    </Box>
  );
}

export default RunRequest;
