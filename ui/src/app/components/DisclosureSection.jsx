import { Box } from '@mui/material';
import { useState } from 'react';

function DisclosureSection({
  children,
  className = '',
  defaultOpen = false,
  meta = null,
  title
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const classes = [
    'disclosure-section',
    isOpen ? 'is-open' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Box className={classes}>
      <button
        type="button"
        className="disclosure-summary"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span className="disclosure-title">{title}</span>
        {meta ? <span className="disclosure-meta">{meta}</span> : null}
      </button>
      <Box className="disclosure-body" hidden={!isOpen}>
        {children}
      </Box>
    </Box>
  );
}

export default DisclosureSection;
