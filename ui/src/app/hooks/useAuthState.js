import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import { clearStoredPassword, getStoredPassword, onAuthRequired, setStoredPassword } from '../../auth-storage.js';

function useAuthState() {
  const isTestEnv = import.meta.env.MODE === 'test';
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(isTestEnv);
  const [checking, setChecking] = useState(!isTestEnv);
  const [error, setError] = useState('');

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const status = await apiRequest('/api/settings/password');
      const required = Boolean(status?.hasPassword);
      setPasswordRequired(required);
      if (!required) {
        clearStoredPassword();
        setAuthenticated(true);
        return;
      }
      const stored = getStoredPassword();
      if (stored) {
        try {
          await apiRequest('/api/settings/auth', {
            method: 'POST',
            body: JSON.stringify({ password: stored })
          });
          setAuthenticated(true);
          return;
        } catch (err) {
          clearStoredPassword();
        }
      }
      setAuthenticated(false);
    } catch (err) {
      setAuthenticated(false);
      setError(err.message || 'Unable to check password status');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isTestEnv) {
      setPasswordRequired(false);
      setAuthenticated(true);
      setChecking(false);
      return;
    }
    refreshStatus();
  }, [isTestEnv, refreshStatus]);

  useEffect(() => {
    if (isTestEnv) {
      return () => {};
    }
    return onAuthRequired(() => {
      setAuthenticated(false);
      setPasswordRequired(true);
    });
  }, [isTestEnv]);

  const login = useCallback(async (password) => {
    setError('');
    await apiRequest('/api/settings/auth', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    setStoredPassword(password);
    setPasswordRequired(true);
    setAuthenticated(true);
  }, []);

  const updatePassword = useCallback(async ({ password, currentPassword }) => {
    setError('');
    await apiRequest('/api/settings/password', {
      method: 'POST',
      body: JSON.stringify({ password, currentPassword })
    });
    setStoredPassword(password);
    setPasswordRequired(true);
    setAuthenticated(true);
  }, []);

  const isUnlocked = useMemo(
    () => !checking && (!passwordRequired || authenticated),
    [authenticated, checking, passwordRequired]
  );

  return {
    authenticated,
    checking,
    error,
    isUnlocked,
    login,
    passwordRequired,
    refreshStatus,
    updatePassword
  };
}

export default useAuthState;
