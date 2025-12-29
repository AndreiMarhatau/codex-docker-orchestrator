import { createTheme } from '@mui/material/styles';

const getPalette = (mode, isDark) => ({
  mode,
  primary: {
    main: isDark ? '#5eead4' : '#0f766e',
    dark: isDark ? '#2dd4bf' : '#0b5b52'
  },
  secondary: {
    main: isDark ? '#fb923c' : '#f97316'
  },
  background: {
    default: isDark ? '#0b1116' : '#f5efe6',
    paper: isDark ? '#0f1720' : '#ffffff'
  },
  text: {
    primary: isDark ? '#f8fafc' : '#1f1b16',
    secondary: isDark ? '#cbd5e1' : '#5b5f57'
  },
  success: {
    main: isDark ? '#22c55e' : '#16a34a'
  },
  warning: {
    main: isDark ? '#fbbf24' : '#f59e0b'
  },
  error: {
    main: isDark ? '#f87171' : '#dc2626'
  }
});

const getTypography = () => ({
  fontFamily: '"Space Grotesk", "IBM Plex Sans", sans-serif',
  h1: {
    fontFamily: '"Fraunces", "Space Grotesk", serif',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  },
  h2: {
    fontFamily: '"Fraunces", "Space Grotesk", serif',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  },
  h3: {
    fontFamily: '"Fraunces", "Space Grotesk", serif',
    fontWeight: 600,
    letterSpacing: '-0.01em'
  },
  h4: {
    fontWeight: 600
  },
  h6: {
    fontWeight: 600,
    letterSpacing: '-0.01em'
  },
  subtitle1: {
    fontWeight: 500
  },
  button: {
    fontWeight: 600,
    letterSpacing: '0.01em'
  }
});

const getComponents = (isDark) => ({
  MuiCard: {
    styleOverrides: {
      root: {
        border: isDark
          ? '1px solid rgba(148, 163, 184, 0.16)'
          : '1px solid rgba(17, 24, 39, 0.08)',
        boxShadow: isDark
          ? '0 24px 60px rgba(2, 6, 23, 0.7)'
          : '0 24px 60px rgba(15, 23, 42, 0.08)',
        backgroundImage: isDark
          ? 'linear-gradient(160deg, rgba(15, 23, 32, 0.9), rgba(17, 24, 39, 0.95))'
          : 'linear-gradient(160deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.98))',
        backdropFilter: 'blur(6px)'
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: 999,
        paddingLeft: 18,
        paddingRight: 18
      },
      contained: {
        boxShadow: isDark
          ? '0 12px 30px rgba(15, 23, 42, 0.5)'
          : '0 12px 30px rgba(15, 23, 42, 0.12)'
      }
    }
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        borderRadius: 999,
        padding: 4,
        minHeight: 0,
        background: isDark
          ? 'rgba(15, 23, 42, 0.7)'
          : 'rgba(255, 255, 255, 0.75)',
        border: isDark
          ? '1px solid rgba(148, 163, 184, 0.2)'
          : '1px solid rgba(15, 23, 42, 0.08)'
      },
      indicator: {
        height: '100%',
        borderRadius: 999,
        background: isDark
          ? 'linear-gradient(120deg, rgba(94, 234, 212, 0.2), rgba(14, 116, 110, 0.3))'
          : 'linear-gradient(120deg, rgba(15, 118, 110, 0.18), rgba(249, 115, 22, 0.22))'
      }
    }
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600,
        minHeight: 0,
        padding: '10px 18px',
        borderRadius: 999,
        zIndex: 1
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 600
      }
    }
  }
});

const createAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: getPalette(mode, isDark),
    typography: getTypography(),
    shape: {
      borderRadius: 18
    },
    components: getComponents(isDark)
  });
};

export default createAppTheme;
