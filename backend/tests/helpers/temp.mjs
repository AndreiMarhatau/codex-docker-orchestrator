import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function createTempDir() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-orch-'));
  return base;
}
