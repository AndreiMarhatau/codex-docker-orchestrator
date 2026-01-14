const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { ensureDir, readJson, writeJson, pathExists } = require('./storage');
const { DEFAULT_LABEL_PREFIX } = require('./accounts-helpers');

function ensureStateShape(state) {
  if (!Array.isArray(state.accounts)) {
    state.accounts = [];
  }
  if (!Array.isArray(state.queue)) {
    state.queue = [];
  }
  if (!state.activeAccountId) {
    state.activeAccountId = state.queue[0] || null;
  }
  return state;
}

function attachAccountStoreState(AccountStore) {
  AccountStore.prototype.loadState = async function loadState() {
    let state = null;
    if (await pathExists(this.statePath())) {
      state = await readJson(this.statePath());
    } else {
      state = { accounts: [], queue: [] };
    }
    ensureStateShape(state);
    await this.bootstrapFromHostAuth(state);
    return state;
  };

  AccountStore.prototype.bootstrapFromHostAuth = async function bootstrapFromHostAuth(state) {
    if (state.queue.length > 0) {
      return state;
    }
    if (!(await pathExists(this.hostAuthPath()))) {
      state.activeAccountId = null;
      return state;
    }
    const content = await fs.readFile(this.hostAuthPath(), 'utf8');
    if (!content.trim()) {
      state.activeAccountId = null;
      return state;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      state.activeAccountId = null;
      return state;
    }
    const accountId = crypto.randomUUID();
    const createdAt = this.now();
    const label = `${DEFAULT_LABEL_PREFIX} 1 (host)`;
    state.accounts.push({ id: accountId, label, createdAt });
    state.queue.push(accountId);
    state.activeAccountId = accountId;
    await ensureDir(this.accountDir(accountId));
    await fs.writeFile(this.accountAuthPath(accountId), JSON.stringify(parsed, null, 2));
    await writeJson(this.statePath(), state);
    return state;
  };

  AccountStore.prototype.saveState = async function saveState(state) {
    await writeJson(this.statePath(), state);
  };

  AccountStore.prototype.listAccounts = async function listAccounts() {
    const state = await this.loadState();
    const accountMap = new Map(state.accounts.map((account) => [account.id, account]));
    const ordered = await Promise.all(
      state.queue.map(async (id, index) => {
        const account = accountMap.get(id);
        if (!account) {
          return null;
        }
        let authJson = '';
        try {
          authJson = await fs.readFile(this.accountAuthPath(id), 'utf8');
        } catch (error) {
          authJson = '';
        }
        return {
          ...account,
          authJson,
          position: index + 1,
          isActive: id === state.queue[0]
        };
      })
    );
    return { activeAccountId: state.queue[0] || null, accounts: ordered.filter(Boolean) };
  };

  AccountStore.prototype.getActiveAccount = async function getActiveAccount() {
    const state = await this.loadState();
    const activeId = state.queue[0] || null;
    if (!activeId) {
      return null;
    }
    const account = state.accounts.find((entry) => entry.id === activeId);
    if (!account) {
      return { id: activeId, label: null };
    }
    return { id: account.id, label: account.label };
  };
}

module.exports = { attachAccountStoreState };
