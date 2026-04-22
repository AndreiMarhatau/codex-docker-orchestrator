import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function isMockFlagEnabled(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const enableMockBundle =
    command !== 'build' ||
    isMockFlagEnabled(env.VITE_ENABLE_MOCK_DATA) ||
    isMockFlagEnabled(env.VITE_MOCK_API);
  const outDir = env.VITE_BUILD_OUT_DIR || 'dist';

  return {
    plugins: [react()],
    define: {
      __ENABLE_MOCK_BUNDLE__: JSON.stringify(enableMockBundle)
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:8080'
      }
    },
    build: {
      outDir
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.js'],
      globals: true,
      maxWorkers: 1,
      minWorkers: 1,
      coverage: {
        provider: 'v8',
        all: true,
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/mock/**/*'],
        thresholds: {
          branches: 80,
          lines: 80,
          functions: 80,
          statements: 80
        }
      }
    }
  };
});
