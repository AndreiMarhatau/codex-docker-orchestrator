import { useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyAccountForm } from '../constants.js';
import { normalizeAccountState } from '../repo-helpers.js';

function useAccountsState({ accountState, setAccountState, setError, setLoading }) {
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [rateLimits, setRateLimits] = useState(null);
  const [rateLimitsLoading, setRateLimitsLoading] = useState(false);
  const [rateLimitsError, setRateLimitsError] = useState('');
  const [rateLimitsFetchedAt, setRateLimitsFetchedAt] = useState('');

  const activeAccount = useMemo(
    () => accountState.accounts.find((account) => account.isActive),
    [accountState]
  );

  async function refreshAccounts() {
    const accountData = await apiRequest('/api/accounts');
    setAccountState(normalizeAccountState(accountData));
  }

  async function refreshRateLimits() {
    setRateLimitsError('');
    setRateLimitsLoading(true);
    try {
      const info = await apiRequest('/api/accounts/rate-limits');
      setRateLimits(info.rateLimits || null);
      setRateLimitsFetchedAt(info.fetchedAt || '');
    } catch (err) {
      setRateLimits(null);
      setRateLimitsFetchedAt('');
      setRateLimitsError(err.message);
    } finally {
      setRateLimitsLoading(false);
    }
  }

  async function handleAddAccount() {
    if (!accountForm.authJson.trim()) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(accountForm)
      });
      if (payload?.accounts) {
        setAccountState(normalizeAccountState(payload));
      } else {
        await refreshAccounts();
      }
      setAccountForm(emptyAccountForm);
      setShowAccountForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateAccount(accountId) {
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/accounts/${accountId}/activate`, { method: 'POST' });
      setAccountState(normalizeAccountState(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRotateAccount() {
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest('/api/accounts/rotate', { method: 'POST' });
      setAccountState(normalizeAccountState(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount(accountId) {
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/accounts/${accountId}`, { method: 'DELETE' });
      setAccountState(normalizeAccountState(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameAccount(accountId, label) {
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify({ label })
      });
      setAccountState(normalizeAccountState(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAuthJson(accountId, authJson) {
    setError('');
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/accounts/${accountId}/auth-json`, {
        method: 'PATCH',
        body: JSON.stringify({ authJson })
      });
      setAccountState(normalizeAccountState(payload));
      return payload;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    accountForm,
    activeAccount,
    handleActivateAccount,
    handleAddAccount,
    handleDeleteAccount,
    handleRenameAccount,
    handleUpdateAuthJson,
    handleRotateAccount,
    rateLimits,
    rateLimitsError,
    rateLimitsFetchedAt,
    rateLimitsLoading,
    refreshAccounts,
    refreshRateLimits,
    setAccountForm,
    setShowAccountForm,
    showAccountForm
  };
}

export default useAccountsState;
