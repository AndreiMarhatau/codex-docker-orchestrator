import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { AccountStore } = require('../src/accounts');

describe('AccountStore', () => {
  it('bootstraps from host auth.json when no accounts exist', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const hostAuth = { token: 'host-token' };
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify(hostAuth, null, 2));

    const store = new AccountStore({
      orchHome,
      codexHome,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(1);
    expect(list.accounts[0].isActive).toBe(true);
    const storedAuth = JSON.parse(
      await fs.readFile(path.join(orchHome, 'accounts', list.accounts[0].id, 'auth.json'), 'utf8')
    );
    expect(storedAuth).toEqual(hostAuth);
  });

  it('rotates accounts and applies auth.json to host', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'a' }, null, 2));

    const store = new AccountStore({
      orchHome,
      codexHome,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    await store.addAccount({ label: 'Second', authJson: JSON.stringify({ token: 'b' }) });
    const before = await store.listAccounts();
    expect(before.accounts).toHaveLength(2);
    expect(before.accounts[0].isActive).toBe(true);

    await store.rotateActiveAccount();
    const after = await store.listAccounts();
    expect(after.accounts[0].isActive).toBe(true);
    expect(after.accounts[0].id).toBe(before.accounts[1].id);
    const hostAuth = JSON.parse(
      await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8')
    );
    expect(hostAuth).toEqual({ token: 'b' });
  });

  it('prevents removing the active account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'a' }, null, 2));

    const store = new AccountStore({
      orchHome,
      codexHome,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const list = await store.listAccounts();
    await expect(store.removeAccount(list.activeAccountId)).rejects.toThrow(
      'Cannot remove the active account'
    );
  });
});
