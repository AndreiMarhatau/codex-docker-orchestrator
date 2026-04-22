import { alpha } from '@mui/material/styles';

function createButtonStyles(theme, subtleBackground) {
  return {
    defaultProps: {
      disableElevation: true
    },
    styleOverrides: {
      root: {
        minHeight: 40,
        borderRadius: 10,
        paddingLeft: 16,
        paddingRight: 16,
        fontWeight: 600,
        letterSpacing: 0,
        textTransform: 'none'
      },
      contained: {
        backgroundColor: theme.palette.primary.main,
        '&:hover': {
          backgroundColor: theme.palette.primary.dark
        }
      },
      outlined: {
        borderColor: theme.palette.divider,
        backgroundColor: alpha(subtleBackground, 0.4),
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.4),
          backgroundColor: alpha(theme.palette.primary.main, 0.06)
        }
      },
      text: {
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.08)
        }
      }
    }
  };
}

function createInputStyles(theme, inputBackground) {
  return {
    styleOverrides: {
      root: {
        borderRadius: 10,
        backgroundColor: inputBackground,
        '& fieldset': {
          borderColor: theme.palette.divider
        },
        '&:hover fieldset': {
          borderColor: alpha(theme.palette.primary.main, 0.4)
        },
        '&.Mui-focused fieldset': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`
        }
      }
    }
  };
}

function createSurfaceStyles(theme, isDark) {
  return {
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
          backgroundColor: theme.palette.background.paper,
          boxShadow: isDark
            ? '0 24px 80px rgba(0, 0, 0, 0.45)'
            : '0 24px 60px rgba(15, 23, 42, 0.16)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
          boxShadow: 'none'
        }
      }
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: 'none',
          '&::before': {
            display: 'none'
          }
        }
      }
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: isDark
            ? '0 16px 48px rgba(0, 0, 0, 0.42)'
            : '0 16px 48px rgba(15, 23, 42, 0.14)'
        }
      }
    }
  };
}

function createMiscStyles(theme, isDark) {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': {
          backgroundColor: alpha(theme.palette.primary.main, 0.2)
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.95rem'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600
        }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1)
        }
      }
    }
  };
}

function getComponents(theme) {
  const isDark = theme.palette.mode === 'dark';
  const inputBackground = isDark ? '#1f2630' : '#ffffff';
  const subtleBackground = isDark ? '#202833' : '#f8fafc';

  return {
    MuiButton: createButtonStyles(theme, subtleBackground),
    MuiOutlinedInput: createInputStyles(theme, inputBackground),
    ...createSurfaceStyles(theme, isDark),
    ...createMiscStyles(theme, isDark)
  };
}

export default getComponents;
