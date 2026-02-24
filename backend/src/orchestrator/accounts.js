const { USAGE_TRIGGER_PROMPT, runAccountUsageTrigger } = require('./account-usage-trigger');
const { buildRateLimitEnv, readAccountRateLimits } = require('./account-rate-limits-client');

function attachAccountMethods(Orchestrator) {
  Orchestrator.prototype.listAccounts = async function listAccounts() {
    return this.accountStore.listAccounts();
  };

  Orchestrator.prototype.addAccount = async function addAccount({ label, authJson }) {
    const account = await this.accountStore.addAccount({ label, authJson });
    await this.accountStore.applyActiveAccount();
    return account;
  };

  Orchestrator.prototype.activateAccount = async function activateAccount(accountId) {
    await this.accountStore.setActiveAccount(accountId);
    return this.listAccounts();
  };

  Orchestrator.prototype.rotateAccount = async function rotateAccount() {
    await this.accountStore.rotateActiveAccount();
    return this.listAccounts();
  };

  Orchestrator.prototype.removeAccount = async function removeAccount(accountId) {
    await this.accountStore.removeAccount(accountId);
    return this.listAccounts();
  };

  Orchestrator.prototype.updateAccountLabel = async function updateAccountLabel(accountId, label) {
    return this.accountStore.updateAccountLabel(accountId, label);
  };

  Orchestrator.prototype.updateAccountAuthJson = async function updateAccountAuthJson(
    accountId,
    authJson
  ) {
    return this.accountStore.updateAccountAuthJson(accountId, authJson);
  };

  Orchestrator.prototype.getAccountRateLimits = async function getAccountRateLimits() {
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      const { noActiveAccountError } = require('./errors');
      throw noActiveAccountError('No active account. Add or activate an account first.');
    }
    await this.ensureActiveAuth();
    const rateLimits = await this.fetchAccountRateLimits();
    const latestActiveAccount = await this.accountStore.getActiveAccount();
    if (latestActiveAccount?.id === activeAccount.id) {
      try {
        await this.accountStore.syncAccountFromHost(activeAccount.id);
      } catch (error) {
        // Best-effort: keep rate-limit reads resilient to auth sync issues.
      }
    }
    return {
      account: activeAccount,
      rateLimits,
      fetchedAt: this.now()
    };
  };

  Orchestrator.prototype.triggerAccountUsage = async function triggerAccountUsage() {
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      const { noActiveAccountError } = require('./errors');
      throw noActiveAccountError('No active account. Add or activate an account first.');
    }
    await this.ensureActiveAuth();
    await runAccountUsageTrigger({
      spawn: this.spawn,
      env: buildRateLimitEnv(this.codexHome)
    });
    const latestActiveAccount = await this.accountStore.getActiveAccount();
    if (latestActiveAccount?.id === activeAccount.id) {
      try {
        await this.accountStore.syncAccountFromHost(activeAccount.id);
      } catch (error) {
        // Best-effort: keep usage triggers resilient to auth sync issues.
      }
    }
    return {
      account: activeAccount,
      prompt: USAGE_TRIGGER_PROMPT,
      triggeredAt: this.now()
    };
  };

  Orchestrator.prototype.fetchAccountRateLimits = async function fetchAccountRateLimits() {
    return this.fetchAccountRateLimitsForHome(this.codexHome);
  };

  Orchestrator.prototype.fetchAccountRateLimitsForHome = async function fetchAccountRateLimitsForHome(
    codexHome
  ) {
    return readAccountRateLimits({ spawn: this.spawn, codexHome });
  };
}

module.exports = {
  attachAccountMethods
};
