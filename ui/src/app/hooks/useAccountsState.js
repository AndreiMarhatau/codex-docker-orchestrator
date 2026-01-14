import { useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyAccountForm } from '../constants.js';
import { normalizeAccountState } from '../repo-helpers.js';

async function fetchAccounts(setAccountState) {
  const accountData = await apiRequest('/api/accounts');
  setAccountState(normalizeAccountState(accountData));
}

async function fetchRateLimits({
  setRateLimits,
  setRateLimitsError,
  setRateLimitsFetchedAt,
  setRateLimitsLoading
}) {
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

function createAccountRequestHandler({ request, setAccountState, setError, setLoading }) {
  return async (...args) => {
    setError('');
    setLoading(true);
    try {
      const payload = await request(...args);
      setAccountState(normalizeAccountState(payload));
      return payload;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };
}

function createAddAccountHandler({
  accountForm,
  refreshAccounts,
  setAccountForm,
  setAccountState,
  setError,
  setLoading,
  setShowAccountForm
}) {
  return async () => {
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
  };
}

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

  const refreshAccounts = () => fetchAccounts(setAccountState);
  const refreshRateLimits = () =>
    fetchRateLimits({
      setRateLimits,
      setRateLimitsError,
      setRateLimitsFetchedAt,
      setRateLimitsLoading
    });
  const handleAddAccount = createAddAccountHandler({
    accountForm,
    refreshAccounts,
    setAccountForm,
    setAccountState,
    setError,
    setLoading,
    setShowAccountForm
  });
  const handleActivateAccount = createAccountRequestHandler({
    request: (accountId) =>
      apiRequest(`/api/accounts/${accountId}/activate`, { method: 'POST' }),
    setAccountState,
    setError,
    setLoading
  });
  const handleRotateAccount = createAccountRequestHandler({
    request: () => apiRequest('/api/accounts/rotate', { method: 'POST' }),
    setAccountState,
    setError,
    setLoading
  });
  const handleDeleteAccount = createAccountRequestHandler({
    request: (accountId) => apiRequest(`/api/accounts/${accountId}`, { method: 'DELETE' }),
    setAccountState,
    setError,
    setLoading
  });
  const handleRenameAccount = createAccountRequestHandler({
    request: (accountId, label) =>
      apiRequest(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify({ label })
      }),
    setAccountState,
    setError,
    setLoading
  });
  const handleUpdateAuthJson = createAccountRequestHandler({
    request: (accountId, authJson) =>
      apiRequest(`/api/accounts/${accountId}/auth-json`, {
        method: 'PATCH',
        body: JSON.stringify({ authJson })
      }),
    setAccountState,
    setError,
    setLoading
  });

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
