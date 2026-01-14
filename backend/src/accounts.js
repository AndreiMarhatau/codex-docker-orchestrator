const path = require('node:path');
const os = require('node:os');
const { attachAccountStoreActions } = require('./account-store-actions');
const { attachAccountStoreState } = require('./account-store-state');
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
}
attachAccountStoreState(AccountStore);
attachAccountStoreActions(AccountStore);
module.exports = { AccountStore };
