import { Box } from '@mui/material';

function MetaPill({ children, className = '', tone = 'default' }) {
  const classes = ['meta-pill', `meta-pill--${tone}`, className].filter(Boolean).join(' ');

  return (
    <Box component="span" className={classes}>
      {children}
    </Box>
  );
}

export default MetaPill;
