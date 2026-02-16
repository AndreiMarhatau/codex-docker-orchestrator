import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runCommand } = require('../src/commands');

describe('runCommand', () => {
  it('captures stdout and exit code', async () => {
    const result = await runCommand('node', ['-e', "console.log('ok')"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
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
});
