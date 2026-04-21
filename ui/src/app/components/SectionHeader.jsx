import { Box, Chip, Stack, Typography } from '@mui/material';

function SectionHeader({
  actions = null,
  chips = [],
  description = '',
  eyebrow = '',
  icon = null,
  title,
  children = null
}) {
  return (
    <Box className="section-hero">
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
        >
          <Stack spacing={0.9} sx={{ maxWidth: 760 }}>
            {eyebrow && (
              <Typography className="section-eyebrow">
                {eyebrow}
              </Typography>
            )}
            <Stack direction="row" spacing={1.25} alignItems="center">
              {icon && <Box className="section-icon">{icon}</Box>}
              <Typography component="h2" variant="h4" className="section-title">
                {title}
              </Typography>
            </Stack>
            {description && (
              <Typography className="section-description">
                {description}
              </Typography>
            )}
          </Stack>
          {actions && <Box className="section-actions">{actions}</Box>}
        </Stack>

        {(chips.length > 0 || children) && (
          <Stack spacing={2}>
            {chips.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {chips.map((chip) => (
                  <Chip
                    key={chip.key || chip.label}
                    className={`section-chip${chip.tone ? ` section-chip--${chip.tone}` : ''}`}
                    label={chip.label}
                    size="small"
                    variant={chip.variant || 'filled'}
                  />
                ))}
              </Stack>
            )}
            {children}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default SectionHeader;
