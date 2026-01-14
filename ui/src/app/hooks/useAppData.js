import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api.js';
import { normalizeAccountState } from '../repo-helpers.js';

function useAppData({ enabled = true } = {}) {
  const [envs, setEnvs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [accountState, setAccountState] = useState({ accounts: [], activeAccountId: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshAll = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const [envData, taskData, accountData] = await Promise.all([
      apiRequest('/api/envs'),
      apiRequest('/api/tasks'),
      apiRequest('/api/accounts')
    ]);
    setEnvs(envData);
    setTasks(taskData);
    setAccountState(normalizeAccountState(accountData));
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
    setAccountState,
    setEnvs,
    setError,
    setLoading,
    setTasks,
    tasks
  };
}

export default useAppData;
