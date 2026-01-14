import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render as rtlRender } from '@testing-library/react';

const theme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true
      }
    },
    MuiTooltip: {
      defaultProps: {
        disableFocusListener: true,
        disableHoverListener: true,
        disableTouchListener: true
      }
    }
  }
});

const Wrapper = ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;

const render = (ui, options = {}) => rtlRender(ui, { wrapper: Wrapper, ...options });

export * from '@testing-library/react';
export { render };
