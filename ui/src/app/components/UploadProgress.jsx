import { LinearProgress, Stack, Typography } from '@mui/material';
import { formatBytes } from '../formatters.js';

function UploadProgress({ progress }) {
  if (!progress) {
    return null;
  }
  const hasTotal = Number.isFinite(progress.total) && progress.total > 0;
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
  const valueLabel = hasTotal
    ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
    : formatBytes(progress.loaded);

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" fontWeight={600}>
          Uploading attachments
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasTotal ? `${percent}% • ${valueLabel}` : valueLabel}
        </Typography>
      </Stack>
      <LinearProgress
        variant={hasTotal ? 'determinate' : 'indeterminate'}
        value={hasTotal ? percent : undefined}
        aria-label="Attachment upload progress"
      />
    </Stack>
  );
}

export default UploadProgress;
