import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api.js';
import { normalizeAccountState } from '../repo-helpers.js';

function useAppData({ enabled = true } = {}) {
  const [envs, setEnvs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [accountState, setAccountState] = useState({ accounts: [], activeAccountId: null });
  const [setupState, setSetupState] = useState({
    ready: false,
    gitTokenConfigured: false,
    accountConfigured: false,
    gitUserName: '',
    gitUserEmail: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshAll = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const [setupData, accountData] = await Promise.all([
      apiRequest('/api/settings/setup'),
      apiRequest('/api/accounts')
    ]);
    setSetupState({
      ready: Boolean(setupData?.ready),
      gitTokenConfigured: Boolean(setupData?.gitTokenConfigured),
      accountConfigured: Boolean(setupData?.accountConfigured),
      gitUserName: setupData?.gitUserName || '',
      gitUserEmail: setupData?.gitUserEmail || ''
    });
    setAccountState(normalizeAccountState(accountData));
    if (!setupData?.ready) {
      setEnvs([]);
      setTasks([]);
      return;
    }
    const [envData, taskData] = await Promise.all([
      apiRequest('/api/envs'),
      apiRequest('/api/tasks')
    ]);
    setEnvs(envData);
    setTasks(taskData);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    refreshAll().catch((err) => setError(err.message));
  }, [enabled, refreshAll]);

  return {
    accountState,
    envs,
    error,
    loading,
    refreshAll,
    setupState,
    setAccountState,
    setEnvs,
    setError,
    setSetupState,
    setLoading,
    setTasks,
    tasks
  };
}

export default useAppData;
