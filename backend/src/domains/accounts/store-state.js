const fs = require('node:fs/promises');
const { readJson, pathExists, writeJson } = require('../../shared/filesystem/storage');

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
