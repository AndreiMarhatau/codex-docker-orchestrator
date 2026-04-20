import { Box, Stack, Typography } from '@mui/material';

function WorkspaceHeader({
  actions = null,
  eyebrow = '',
  meta = null,
  subtitle = '',
  title
}) {
  return (
    <Box className="workspace-header">
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'flex-end' }}
      >
        <Stack spacing={0.85} sx={{ minWidth: 0 }}>
          {eyebrow ? <Typography className="workspace-eyebrow">{eyebrow}</Typography> : null}
          <Typography component="h2" className="workspace-title">{title}</Typography>
          {subtitle ? <Typography className="workspace-subtitle">{subtitle}</Typography> : null}
        </Stack>
        {actions ? <Box className="workspace-actions">{actions}</Box> : null}
      </Stack>
      {meta ? <Box className="workspace-meta">{meta}</Box> : null}
    </Box>
  );
}

export default WorkspaceHeader;
