/* global __ENABLE_MOCK_BUNDLE__ */
import { StrictMode, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import App from './App.jsx';
import createAppTheme from './theme.js';
import './styles.css';
import './redesign.css';

const normalizedMockDataFlag = String(import.meta.env.VITE_ENABLE_MOCK_DATA || '').trim().toLowerCase();
const normalizedLegacyMockFlag = String(import.meta.env.VITE_MOCK_API || '').trim().toLowerCase();
const isMockPreviewEnabled =
  normalizedMockDataFlag === '1' ||
  normalizedMockDataFlag === 'true' ||
  normalizedMockDataFlag === 'yes' ||
  normalizedMockDataFlag === 'on' ||
  normalizedLegacyMockFlag === '1' ||
  normalizedLegacyMockFlag === 'true' ||
  normalizedLegacyMockFlag === 'yes' ||
  normalizedLegacyMockFlag === 'on';

function getThemeOverride() {
  if (typeof window === 'undefined') {
    return '';
  }
  const value = new URL(window.location.href).searchParams.get('theme') || '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'light' || normalized === 'dark') {
    return normalized;
  }
  return '';
}

const ThemeBridge = () => {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const themeMode = getThemeOverride() || (prefersDark ? 'dark' : 'light');
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
};

async function bootstrap() {
  if (__ENABLE_MOCK_BUNDLE__ && isMockPreviewEnabled) {
    const { installMockApi } = await import('./mock/mockApi.js');
    installMockApi();
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeBridge />
    </StrictMode>
  );
}

void bootstrap();
