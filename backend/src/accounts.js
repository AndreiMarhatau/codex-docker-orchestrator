const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const {
  ensureDir,
  readJson,
  writeJson,
  pathExists,
  removePath
} = require('./storage');
const { DEFAULT_LABEL_PREFIX, normalizeLabel, parseAuthJson } = require('./accounts-helpers');
class AccountStore {
  constructor({ orchHome, codexHome, now } = {}) {
    this.orchHome = orchHome || path.join(os.homedir(), '.codex-orchestrator');
    this.codexHome = codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    this.now = now || (() => new Date().toISOString());
  }
  accountsDir() { return path.join(this.orchHome, 'accounts'); }
  statePath() { return path.join(this.accountsDir(), 'accounts.json'); }
  hostAuthPath() { return path.join(this.codexHome, 'auth.json'); }
  accountDir(accountId) { return path.join(this.accountsDir(), accountId); }
  accountAuthPath(accountId) { return path.join(this.accountDir(accountId), 'auth.json'); }
  async loadState() {
    let state = null;
    if (await pathExists(this.statePath())) {
      state = await readJson(this.statePath());
    } else {
      state = { accounts: [], queue: [] };
    }
    if (!Array.isArray(state.accounts)) {
      state.accounts = [];
    }
    if (!Array.isArray(state.queue)) {
      state.queue = [];
    }
    if (!state.activeAccountId) {
      state.activeAccountId = state.queue[0] || null;
    }
    await this.bootstrapFromHostAuth(state);
    return state;
  }
  async bootstrapFromHostAuth(state) {
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
  }
  async saveState(state) { await writeJson(this.statePath(), state); }

  async listAccounts() {
    const state = await this.loadState();
    const accountMap = new Map(state.accounts.map((account) => [account.id, account]));
    const ordered = state.queue
      .map((id, index) => {
        const account = accountMap.get(id);
        if (!account) {
          return null;
        }
        return {
          ...account,
          position: index + 1,
          isActive: id === state.queue[0]
        };
      })
      .filter(Boolean);
    return {
      activeAccountId: state.queue[0] || null,
      accounts: ordered
    };
  }

  async getActiveAccount() {
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
  }

  async addAccount({ label, authJson }) {
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
  }

  async setActiveAccount(accountId) {
    const state = await this.loadState();
    if (!state.queue.includes(accountId)) {
      throw new Error('Account not found');
    }
    state.queue = [accountId, ...state.queue.filter((id) => id !== accountId)];
    state.activeAccountId = accountId;
    await this.saveState(state);
    await this.applyActiveAccount();
    return accountId;
  }

  async rotateActiveAccount() {
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
  }

  async removeAccount(accountId) {
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
  }

  async applyActiveAccount() {
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
  }
  async countAccounts() {
    const state = await this.loadState();
    return state.queue.length;
  }
}

module.exports = {
  AccountStore
};
