const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { ensureDir, pathExists, removePath } = require('./storage');
const { DEFAULT_LABEL_PREFIX, normalizeLabel, parseAuthJson } = require('./accounts-helpers');

function attachAccountStoreActions(AccountStore) {
  AccountStore.prototype.addAccount = async function addAccount({ label, authJson }) {
    const parsed = parseAuthJson(authJson);
    const state = await this.loadState();
    const accountId = crypto.randomUUID();
    const createdAt = this.now();
    const fallbackLabel = `${DEFAULT_LABEL_PREFIX} ${state.accounts.length + 1}`;
    const normalizedLabel = normalizeLabel(label, fallbackLabel);
    state.accounts.push({ id: accountId, label: normalizedLabel, createdAt });
    state.queue.push(accountId);
    if (!state.activeAccountId) {
      state.activeAccountId = accountId;
    }
    await ensureDir(this.accountDir(accountId));
    await fs.writeFile(this.accountAuthPath(accountId), JSON.stringify(parsed, null, 2));
    await this.saveState(state);
    return { id: accountId, label: normalizedLabel, createdAt };
  };

  AccountStore.prototype.setActiveAccount = async function setActiveAccount(accountId) {
    const state = await this.loadState();
    if (!state.queue.includes(accountId)) {
      throw new Error('Account not found');
    }
    state.queue = [accountId, ...state.queue.filter((id) => id !== accountId)];
    state.activeAccountId = accountId;
    await this.saveState(state);
    await this.applyActiveAccount();
    return accountId;
  };

  AccountStore.prototype.rotateActiveAccount = async function rotateActiveAccount() {
    const state = await this.loadState();
    if (state.queue.length < 2) {
      return null;
    }
    const current = state.queue.shift();
    state.queue.push(current);
    state.activeAccountId = state.queue[0] || null;
    await this.saveState(state);
    await this.applyActiveAccount();
    return state.activeAccountId;
  };

  AccountStore.prototype.removeAccount = async function removeAccount(accountId) {
    const state = await this.loadState();
    const existing = state.queue.includes(accountId);
    if (!existing) {
      throw new Error('Account not found');
    }
    if (state.queue[0] === accountId) {
      throw new Error('Cannot remove the active account');
    }
    state.queue = state.queue.filter((id) => id !== accountId);
    state.accounts = state.accounts.filter((account) => account.id !== accountId);
    state.activeAccountId = state.queue[0] || null;
    await this.saveState(state);
    await removePath(this.accountDir(accountId));
    if (state.activeAccountId) {
      await this.applyActiveAccount();
    } else if (await pathExists(this.hostAuthPath())) {
      await removePath(this.hostAuthPath());
    }
  };

  AccountStore.prototype.applyActiveAccount = async function applyActiveAccount() {
    const state = await this.loadState();
    const activeId = state.queue[0] || null;
    if (!activeId) {
      return null;
    }
    const sourcePath = this.accountAuthPath(activeId);
    if (!(await pathExists(sourcePath))) {
      throw new Error('Active account auth.json missing');
    }
    await ensureDir(this.codexHome);
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(this.hostAuthPath(), content, { mode: 0o600 });
    return activeId;
  };

  AccountStore.prototype.updateAccountLabel = async function updateAccountLabel(accountId, label) {
    const state = await this.loadState();
    const account = state.accounts.find((entry) => entry.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    const normalizedLabel = normalizeLabel(label, account.label || account.id);
    account.label = normalizedLabel;
    await this.saveState(state);
    return this.listAccounts();
  };

  AccountStore.prototype.updateAccountAuthJson = async function updateAccountAuthJson(
    accountId,
    authJson
  ) {
    const parsed = parseAuthJson(authJson);
    const state = await this.loadState();
    const account = state.accounts.find((entry) => entry.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    await ensureDir(this.accountDir(accountId));
    await fs.writeFile(this.accountAuthPath(accountId), JSON.stringify(parsed, null, 2));
    if (state.queue[0] === accountId) {
      await this.applyActiveAccount();
    }
    return this.listAccounts();
  };

  AccountStore.prototype.countAccounts = async function countAccounts() {
    return (await this.loadState()).queue.length;
  };
  attachAccountSyncMethods(AccountStore);
}

function attachAccountSyncMethods(AccountStore) {
  AccountStore.prototype.syncAccountFromHost = async function syncAccountFromHost(accountId) {
    if (!accountId) {
      return null;
    }
    const state = await this.loadState();
    if (!state.queue.includes(accountId) || !(await pathExists(this.hostAuthPath()))) {
      return null;
    }
    const content = await fs.readFile(this.hostAuthPath(), 'utf8');
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = JSON.parse(trimmed);
    await ensureDir(this.accountDir(accountId));
    await fs.writeFile(this.accountAuthPath(accountId), JSON.stringify(parsed, null, 2), { mode: 0o600 });
    return accountId;
  };

  AccountStore.prototype.syncActiveAccountFromHost = async function syncActiveAccountFromHost() {
    const state = await this.loadState();
    return this.syncAccountFromHost(state.queue[0] || null);
  };
}

module.exports = { attachAccountStoreActions };
