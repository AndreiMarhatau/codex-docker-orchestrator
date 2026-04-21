/* eslint-disable max-lines, max-lines-per-function */
import { alpha, createTheme } from '@mui/material/styles';

function getPalette(mode, isDark) {
  return {
    mode,
    primary: {
      main: isDark ? '#8ec4b2' : '#1d6b57',
      light: isDark ? '#b7ddd2' : '#4c947f',
      dark: isDark ? '#5f9c88' : '#14493d',
      contrastText: isDark ? '#0b1412' : '#f7f1e5'
    },
    secondary: {
      main: isDark ? '#e0b86a' : '#b77a26',
      light: isDark ? '#efd396' : '#cf9a4f',
      dark: isDark ? '#c89335' : '#8c5d1a'
    },
    background: {
      default: isDark ? '#0f120f' : '#f2f0eb',
      paper: isDark ? '#171b18' : '#fbf8f2'
    },
    text: {
      primary: isDark ? '#f2ecdf' : '#1f1c17',
      secondary: isDark ? '#b8afa0' : '#655c52'
    },
    divider: isDark ? 'rgba(226, 216, 201, 0.12)' : 'rgba(83, 72, 55, 0.12)',
    success: {
      main: isDark ? '#7dd9ab' : '#2d8b66'
    },
    warning: {
      main: isDark ? '#f2c16e' : '#b97d26'
    },
    error: {
      main: isDark ? '#f09493' : '#b85b5e'
    },
    info: {
      main: isDark ? '#9cc7e2' : '#3d728f'
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
    ? `linear-gradient(180deg, ${alpha('#1d221d', 0.96)}, ${alpha('#141816', 0.98)})`
    : `linear-gradient(180deg, ${alpha('#fffdf7', 0.96)}, ${alpha('#f7f2e8', 0.98)})`;

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
            ? '0 22px 64px rgba(0, 0, 0, 0.32)'
            : '0 24px 56px rgba(58, 43, 19, 0.08)',
          backdropFilter: 'blur(20px)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingLeft: 18,
          paddingRight: 18,
          minHeight: 42
        },
        contained: {
          boxShadow: isDark
            ? '0 16px 30px rgba(29, 107, 87, 0.28)'
            : '0 16px 30px rgba(29, 107, 87, 0.18)'
        },
        outlined: {
          borderColor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.18),
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.04 : 0.025)
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 999
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 650,
          borderRadius: 999,
          backdropFilter: 'blur(18px)',
          minHeight: 28,
          alignItems: 'center'
        },
        label: {
          lineHeight: '28px',
          paddingLeft: 10,
          paddingRight: 10
        },
        filled: {
          backgroundColor: isDark
            ? alpha(theme.palette.common.white, 0.08)
            : alpha(theme.palette.secondary.main, 0.08)
        },
        outlined: {
          borderColor: theme.palette.divider,
          backgroundColor: isDark
            ? alpha(theme.palette.common.white, 0.03)
            : alpha('#fffdf8', 0.78)
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
              ? alpha(theme.palette.primary.main, 0.18)
              : alpha(theme.palette.primary.main, 0.1),
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.16)
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
            : alpha('#fffdf8', 0.86),
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
