import { useEffect } from 'react';
import useAccountsState from './useAccountsState.js';
import useActiveTab from './useActiveTab.js';
import useAppData from './useAppData.js';
import useAuthState from './useAuthState.js';
import useEnvironmentState from './useEnvironmentState.js';
import usePolling from './usePolling.js';
import useTasksState from './useTasksState.js';

function useAppState() {
  const authState = useAuthState();
  const data = useAppData({ enabled: authState.isUnlocked });
  const tabState = useActiveTab();
  const tasksState = useTasksState({
    envs: data.envs,
    refreshAll: data.refreshAll,
    setError: data.setError,
    setLoading: data.setLoading,
    tasks: data.tasks
  });
  const envState = useEnvironmentState({
    envs: data.envs,
    refreshAll: data.refreshAll,
    selectedTaskId: tasksState.selection.selectedTaskId,
    setError: data.setError,
    setLoading: data.setLoading,
    setSelectedTaskId: tasksState.selection.setSelectedTaskId,
    setTaskDetail: tasksState.detail.setTaskDetail,
    tasks: data.tasks
  });
  const accountsState = useAccountsState({
    accountState: data.accountState,
    setAccountState: data.setAccountState,
    setError: data.setError,
    setLoading: data.setLoading
  });
  const { setSelectedTaskId } = tasksState.selection;
  const { setTaskDetail } = tasksState.detail;

  usePolling({
    enabled: authState.isUnlocked,
    refreshAll: data.refreshAll,
    refreshTaskDetail: tasksState.detail.refreshTaskDetail,
    selectedTaskId: tasksState.selection.selectedTaskId
  });

  useEffect(() => {
    if (!authState.isUnlocked) {
      return;
    }
    if (tabState.activeTab !== 2) {
      return;
    }
    accountsState.refreshRateLimits().catch(() => {});
  }, [authState.isUnlocked, tabState.activeTab, accountsState.activeAccount?.id]);

  useEffect(() => {
    if (!authState.isUnlocked) {
      setSelectedTaskId('');
      setTaskDetail(null);
    }
  }, [authState.isUnlocked, setSelectedTaskId, setTaskDetail]);

  return {
    accountsState,
    authState,
    data,
    envState,
    tabState,
    tasksState
  };
}

export default useAppState;
