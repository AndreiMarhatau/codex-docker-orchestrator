import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startServer } = require('../src/server');

function createAppMock() {
  return {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn(() => 'server')
  };
}

describe('server bootstrap', () => {
  it('starts server without static assets when dist is missing', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => false };
    const expressLib = { static: () => 'static-mw' };
    const server = startServer({
      app,
      port: 9090,
      uiDistPath: '/tmp/none',
      expressLib,
      fsLib
    });
    expect(server).toBe('server');
    expect(app.listen).toHaveBeenCalledWith(9090, expect.any(Function));
    expect(app.use).not.toHaveBeenCalled();
    expect(app.get).not.toHaveBeenCalled();
  });

  it('serves static assets when dist exists', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => true };
    const expressLib = { static: () => 'static-mw' };
    startServer({ app, port: 9091, uiDistPath: '/tmp/exists', expressLib, fsLib });
    expect(app.use).toHaveBeenCalledWith('static-mw');
    expect(app.get).toHaveBeenCalledWith('*', expect.any(Function));
    expect(app.listen).toHaveBeenCalledWith(9091, expect.any(Function));
  });

  it('falls back to ORCH_PORT when port is not provided', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => false };
    process.env.ORCH_PORT = '7070';
    startServer({ app, uiDistPath: '/tmp/none', fsLib });
    expect(app.listen).toHaveBeenCalledWith(7070, expect.any(Function));
    delete process.env.ORCH_PORT;
  });

  it('uses default port when neither port nor ORCH_PORT are set', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => false };
    delete process.env.ORCH_PORT;
    startServer({ app, uiDistPath: '/tmp/none', fsLib });
    expect(app.listen).toHaveBeenCalledWith(8080, expect.any(Function));
  });

  it('skips static wiring when express static is unavailable', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => true };
    const expressLib = { static: null };
    startServer({ app, port: 9092, uiDistPath: '/tmp/exists', expressLib, fsLib });
    expect(app.use).not.toHaveBeenCalled();
    expect(app.get).not.toHaveBeenCalled();
  });

  it('creates the app when one is not provided', () => {
    const app = createAppMock();
    const fsLib = { existsSync: () => false };
    startServer({ app: null, createAppFn: () => app, port: 9093, uiDistPath: '/tmp/none', fsLib });
    expect(app.listen).toHaveBeenCalledWith(9093, expect.any(Function));
  });
});
