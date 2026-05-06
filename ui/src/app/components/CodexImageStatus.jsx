import { Box, Typography } from '@mui/material';

const VISIBLE_STATUSES = new Set(['checking', 'pulling', 'failed']);

function statusLabel(status) {
  if (status === 'checking') {
    return 'Checking Codex image';
  }
  if (status === 'pulling') {
    return 'Pulling Codex image';
  }
  if (status === 'failed') {
    return 'Codex image pull failed';
  }
  return '';
}

function CodexImageStatus({ codexImage }) {
  const status = codexImage?.status || 'unknown';
  if (!VISIBLE_STATUSES.has(status)) {
    return null;
  }
  const imageName = codexImage?.imageName || 'Codex runtime image';
  const detail = status === 'failed'
    ? (codexImage?.error || codexImage?.message || 'Docker pull failed.')
    : imageName;

  return (
    <Box className={`codex-image-status codex-image-status--${status}`} role="status">
      <Typography className="codex-image-status-label">{statusLabel(status)}</Typography>
      <Typography className="codex-image-status-detail">{detail}</Typography>
    </Box>
  );
}

export default CodexImageStatus;
