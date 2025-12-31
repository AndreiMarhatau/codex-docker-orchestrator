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
  fontFamily: '"Bricolage Grotesque", "IBM Plex Sans", sans-serif',
  h1: {
    fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  },
  h2: {
    fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  },
  h3: {
    fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
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
          ? '1px solid rgba(148, 163, 184, 0.2)'
          : '1px solid rgba(17, 24, 39, 0.12)',
        boxShadow: isDark
          ? '0 18px 40px rgba(2, 6, 23, 0.55)'
          : '0 18px 40px rgba(15, 23, 42, 0.12)',
        backgroundImage: 'none',
        backdropFilter: 'blur(12px)'
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: 14,
        paddingLeft: 16,
        paddingRight: 16
      },
      contained: {
        boxShadow: isDark
          ? '0 12px 30px rgba(15, 23, 42, 0.4)'
          : '0 12px 30px rgba(15, 23, 42, 0.18)'
      }
    }
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        padding: 2,
        minHeight: 0,
        background: 'transparent',
        border: 'none'
      },
      indicator: {
        height: '100%',
        borderRadius: 14,
        background: isDark ? 'rgba(94, 234, 212, 0.18)' : 'rgba(15, 118, 110, 0.12)'
      }
    }
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600,
        minHeight: 0,
        padding: '10px 16px',
        borderRadius: 14,
        zIndex: 1,
        transition: 'color 0.2s ease'
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
