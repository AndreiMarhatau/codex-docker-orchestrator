import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { AccountStore } = require('../src/accounts');

describe('AccountStore bootstrap', () => {
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

  it('returns empty accounts when host auth is missing', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });

    const store = new AccountStore({ orchHome, codexHome });
    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(0);
    expect(list.activeAccountId).toBe(null);
  });

  it('ignores empty host auth content', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), '   ');

    const store = new AccountStore({ orchHome, codexHome });
    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(0);
    expect(list.activeAccountId).toBe(null);
  });

  it('ignores invalid host auth JSON', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), '{bad json');

    const store = new AccountStore({ orchHome, codexHome });
    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(0);
    expect(list.activeAccountId).toBe(null);
  });

  it('repairs invalid account state on load', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(path.join(orchHome, 'accounts'), { recursive: true });
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(
      path.join(orchHome, 'accounts', 'accounts.json'),
      JSON.stringify({ accounts: 'bad', queue: 'bad', activeAccountId: null })
    );

    const store = new AccountStore({ orchHome, codexHome });
    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(0);
    expect(list.activeAccountId).toBe(null);
  });
});

describe('AccountStore rotation and removal', () => {
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

  it('returns null when rotating with a single account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    await store.addAccount({ label: 'Only', authJson: '{}' });
    const rotated = await store.rotateActiveAccount();
    expect(rotated).toBe(null);
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

describe('AccountStore updates', () => {
  it('includes auth.json content in account listings', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    await store.addAccount({ label: 'Primary', authJson: JSON.stringify({ token: 'x' }) });
    const list = await store.listAccounts();
    expect(list.accounts).toHaveLength(1);
    expect(list.accounts[0].authJson).toContain('"token": "x"');
  });

  it('updates account labels', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const store = new AccountStore({ orchHome, codexHome });

    const created = await store.addAccount({ label: 'Primary', authJson: '{}' });
    const list = await store.updateAccountLabel(created.id, 'Renamed');
    const updated = list.accounts.find((account) => account.id === created.id);
    expect(updated.label).toBe('Renamed');
  });

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
});

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
