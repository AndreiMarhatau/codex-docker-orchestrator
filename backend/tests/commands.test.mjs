import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runCommand } = require('../src/shared/process/commands');

describe('runCommand', () => {
  it('captures stdout and exit code', async () => {
    const result = await runCommand('node', ['-e', "console.log('ok')"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('passes explicit environment variables', async () => {
    const result = await runCommand('node', [
      '-e',
      "process.stdout.write(process.env.ORCH_TEST_COMMAND || '')"
    ], {
      env: {
        ...process.env,
        ORCH_TEST_COMMAND: 'from-env'
      }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('from-env');
  });

  it('captures stderr on failure', async () => {
    const result = await runCommand('node', [
      '-e',
      "process.stderr.write('err'); process.exit(2);"
    ]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('err');
  });

  it('supports abort signal cancellation', async () => {
    const controller = new AbortController();
    const commandPromise = runCommand('node', ['-e', 'setTimeout(() => {}, 10000)'], {
      signal: controller.signal
    });
    setTimeout(() => controller.abort(), 20);
    await expect(commandPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(runCommand('node', ['-e', "console.log('unused')"], {
      signal: controller.signal
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects spawn failures', async () => {
    await expect(runCommand('definitely-not-a-real-command', []))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
