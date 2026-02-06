import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { AccountStore } = require('../src/accounts');

describe('AccountStore auth.json updates', () => {
  it('updates auth.json and syncs the active account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    const created = await store.addAccount({ label: 'Primary', authJson: '{}' });
    const list = await store.updateAccountAuthJson(
      created.id,
      JSON.stringify({ token: 'updated' })
    );
    const updated = list.accounts.find((account) => account.id === created.id);
    expect(updated.authJson).toContain('"token": "updated"');
    const hostAuth = await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8');
    expect(hostAuth).toContain('"token": "updated"');
  });

  it('updates auth.json without changing host auth for inactive accounts', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    const active = await store.addAccount({ label: 'Active', authJson: '{"token":"a"}' });
    await store.applyActiveAccount();
    const inactive = await store.addAccount({ label: 'Inactive', authJson: '{"token":"b"}' });
    await store.updateAccountAuthJson(inactive.id, '{"token":"b-updated"}');

    const hostAuth = await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8');
    expect(hostAuth).toContain('"token": "a"');

    const list = await store.listAccounts();
    const updated = list.accounts.find((account) => account.id === inactive.id);
    expect(updated.authJson).toContain('"token": "b-updated"');
    const stillActive = list.accounts.find((account) => account.id === active.id);
    expect(stillActive.authJson).toContain('"token": "a"');
  });

  it('syncs refreshed host auth.json back to the active account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    const active = await store.addAccount({
      label: 'Active',
      authJson: '{"tokens":{"access_token":"old","refresh_token":"old-refresh"}}'
    });
    await store.applyActiveAccount();

    await fs.writeFile(
      path.join(codexHome, 'auth.json'),
      JSON.stringify(
        {
          tokens: {
            access_token: 'new',
            refresh_token: 'new-refresh'
          }
        },
        null,
        2
      )
    );

    const synced = await store.syncActiveAccountFromHost();
    expect(synced).toBe(active.id);

    const list = await store.listAccounts();
    const updated = list.accounts.find((account) => account.id === active.id);
    expect(updated.authJson).toContain('"access_token": "new"');
    expect(updated.authJson).toContain('"refresh_token": "new-refresh"');
  });
});
