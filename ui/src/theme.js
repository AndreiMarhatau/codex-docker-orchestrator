import { createTheme } from '@mui/material/styles';
import getComponents from './theme-components.js';

function getPalette(mode) {
  const isDark = mode === 'dark';

  return {
    mode,
    primary: {
      main: '#2563eb',
      light: '#4f83ff',
      dark: '#1d4ed8',
      contrastText: '#ffffff'
    },
    secondary: {
      main: isDark ? '#a7b0be' : '#4b5563',
      light: isDark ? '#c3c9d3' : '#6b7280',
      dark: isDark ? '#8b95a5' : '#374151'
    },
    background: {
      default: isDark ? '#0d131c' : '#f4f5f8',
      paper: isDark ? '#1a212b' : '#ffffff'
    },
    text: {
      primary: isDark ? '#f8fafc' : '#111827',
      secondary: isDark ? '#94a3b8' : '#6b7280'
    },
    divider: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)',
    success: { main: '#22c55e' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    info: { main: '#3b82f6' }
  };
}

function getTypography() {
  return {
    fontFamily: '"Plus Jakarta Sans", "IBM Plex Sans", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.04em' },
    h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.035em' },
    h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' },
    h4: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.015em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none' }
  };
}

const createAppTheme = (mode = 'light') => {
  const theme = createTheme({
    palette: getPalette(mode),
    shape: {
      borderRadius: 12
    },
    typography: getTypography()
  });

  theme.components = getComponents(theme);
  return theme;
};

export default createAppTheme;
