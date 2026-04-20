/* eslint-disable max-lines, max-lines-per-function */
import { alpha, createTheme } from '@mui/material/styles';

function getPalette(mode, isDark) {
  return {
    mode,
    primary: {
      main: isDark ? '#63b3ff' : '#0b63d9',
      light: isDark ? '#9bd0ff' : '#5498ef',
      dark: isDark ? '#2f7de3' : '#0849a2',
      contrastText: '#f8fbff'
    },
    secondary: {
      main: isDark ? '#5eead4' : '#0f766e',
      light: isDark ? '#9af6e7' : '#2ea89d',
      dark: isDark ? '#24bfa4' : '#0a5953'
    },
    background: {
      default: isDark ? '#07111f' : '#eef4fb',
      paper: isDark ? '#0c1829' : '#ffffff'
    },
    text: {
      primary: isDark ? '#edf3ff' : '#0f172a',
      secondary: isDark ? '#9fb2c9' : '#526070'
    },
    divider: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.16)',
    success: {
      main: isDark ? '#4ade80' : '#16a34a'
    },
    warning: {
      main: isDark ? '#fbbf24' : '#d97706'
    },
    error: {
      main: isDark ? '#fb7185' : '#dc2626'
    },
    info: {
      main: isDark ? '#63b3ff' : '#2563eb'
    }
  };
}

function getTypography() {
  return {
    fontFamily: '"Bricolage Grotesque", "IBM Plex Sans", sans-serif',
    h1: {
      fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
      fontWeight: 600,
      letterSpacing: '-0.03em'
    },
    h2: {
      fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
      fontWeight: 600,
      letterSpacing: '-0.025em'
    },
    h3: {
      fontFamily: '"Fraunces", "Bricolage Grotesque", serif',
      fontWeight: 600,
      letterSpacing: '-0.02em'
    },
    h4: {
      fontWeight: 650,
      letterSpacing: '-0.02em'
    },
    h5: {
      fontWeight: 650,
      letterSpacing: '-0.02em'
    },
    h6: {
      fontWeight: 650,
      letterSpacing: '-0.015em'
    },
    subtitle1: {
      fontWeight: 600
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: '-0.01em'
    },
    body2: {
      lineHeight: 1.6
    },
    button: {
      fontWeight: 650,
      letterSpacing: '0.01em',
      textTransform: 'none'
    }
  };
}

function getComponents(theme, isDark) {
  const shellGradient = isDark
    ? `linear-gradient(180deg, ${alpha('#11233c', 0.9)}, ${alpha('#0c1829', 0.92)})`
    : `linear-gradient(180deg, ${alpha('#ffffff', 0.96)}, ${alpha('#f8fbff', 0.98)})`;

  return {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': {
          backgroundColor: alpha(theme.palette.primary.main, 0.32)
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: shellGradient,
          boxShadow: isDark
            ? '0 28px 80px rgba(1, 8, 20, 0.44)'
            : '0 24px 60px rgba(15, 23, 42, 0.08)',
          backdropFilter: 'blur(20px)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingLeft: 18,
          paddingRight: 18,
          minHeight: 42
        },
        contained: {
          boxShadow: isDark
            ? '0 18px 36px rgba(11, 99, 217, 0.24)'
            : '0 18px 32px rgba(37, 99, 235, 0.18)'
        },
        outlined: {
          borderColor: alpha(theme.palette.primary.main, isDark ? 0.34 : 0.22),
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.06 : 0.03)
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 650,
          borderRadius: 999,
          backdropFilter: 'blur(18px)'
        },
        filled: {
          backgroundColor: isDark
            ? alpha(theme.palette.common.white, 0.08)
            : alpha(theme.palette.primary.main, 0.08)
        },
        outlined: {
          borderColor: theme.palette.divider,
          backgroundColor: isDark
            ? alpha(theme.palette.common.white, 0.03)
            : alpha(theme.palette.common.white, 0.72)
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 0
        },
        indicator: {
          display: 'none'
        },
        flexContainer: {
          gap: 8
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 0,
          borderRadius: 14,
          padding: '10px 14px',
          color: theme.palette.text.secondary,
          transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
          border: `1px solid transparent`,
          '&.Mui-selected': {
            color: theme.palette.text.primary,
            backgroundColor: isDark
              ? alpha(theme.palette.primary.main, 0.16)
              : alpha(theme.palette.primary.main, 0.12),
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.16)
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: isDark
            ? alpha(theme.palette.common.white, 0.04)
            : alpha(theme.palette.common.white, 0.82),
          '& fieldset': {
            borderColor: theme.palette.divider
          },
          '&:hover fieldset': {
            borderColor: alpha(theme.palette.primary.main, 0.36)
          },
          '&.Mui-focused fieldset': {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}`
          }
        },
        input: {
          paddingTop: 14,
          paddingBottom: 14
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 28,
          backgroundImage: shellGradient,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: isDark
            ? '0 32px 100px rgba(1, 8, 20, 0.6)'
            : '0 32px 90px rgba(15, 23, 42, 0.16)'
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: theme.palette.divider
        }
      }
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: shellGradient,
          boxShadow: 'none',
          '&::before': {
            display: 'none'
          }
        }
      }
    }
  };
}

const createAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';
  const palette = getPalette(mode, isDark);
  const theme = createTheme({
    palette,
    typography: getTypography(),
    shape: {
      borderRadius: 20
    }
  });

  theme.components = getComponents(theme, isDark);

  return theme;
};

export default createAppTheme;
