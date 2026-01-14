import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { AccountStore } = require('../src/accounts');

describe('AccountStore errors', () => {
  it('returns placeholder when active account metadata is missing', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(path.join(orchHome, 'accounts'), { recursive: true });
    await fs.mkdir(codexHome, { recursive: true });
    const accountId = 'acct-missing';
    await fs.writeFile(
      path.join(orchHome, 'accounts', 'accounts.json'),
      JSON.stringify({ accounts: [], queue: [accountId], activeAccountId: accountId })
    );

    const store = new AccountStore({ orchHome, codexHome });
    const active = await store.getActiveAccount();
    expect(active).toEqual({ id: accountId, label: null });
  });

  it('rejects setting an active account that is not in the queue', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    await expect(store.setActiveAccount('missing')).rejects.toThrow('Account not found');
  });

  it('throws when active account auth.json is missing', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(path.join(orchHome, 'accounts'), { recursive: true });
    await fs.mkdir(codexHome, { recursive: true });
    const accountId = 'acct-1';
    await fs.writeFile(
      path.join(orchHome, 'accounts', 'accounts.json'),
      JSON.stringify({
        accounts: [{ id: accountId, label: 'Missing', createdAt: '2025-01-01T00:00:00.000Z' }],
        queue: [accountId],
        activeAccountId: accountId
      })
    );

    const store = new AccountStore({ orchHome, codexHome });
    await expect(store.applyActiveAccount()).rejects.toThrow(/auth.json missing/);
  });
});
