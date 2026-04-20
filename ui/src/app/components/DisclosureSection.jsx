import { Box } from '@mui/material';

function DisclosureSection({
  children,
  className = '',
  defaultOpen = false,
  meta = null,
  title
}) {
  const classes = ['disclosure-section', className].filter(Boolean).join(' ');

  return (
    <Box component="details" className={classes} {...(defaultOpen ? { open: true } : {})}>
      <summary className="disclosure-summary">
        <span>{title}</span>
        {meta ? <span className="disclosure-meta">{meta}</span> : null}
      </summary>
      <Box className="disclosure-body">
        {children}
      </Box>
    </Box>
  );
}

export default DisclosureSection;
