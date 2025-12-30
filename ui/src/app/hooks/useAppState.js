import { useEffect } from 'react';
import useAccountsState from './useAccountsState.js';
import useActiveTab from './useActiveTab.js';
import useAppData from './useAppData.js';
import useEnvironmentState from './useEnvironmentState.js';
import usePolling from './usePolling.js';
import useSettingsState from './useSettingsState.js';
import useTasksState from './useTasksState.js';

function useAppState() {
  const data = useAppData();
  const tabState = useActiveTab();
  const tasksState = useTasksState({
    activeTab: tabState.activeTab,
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
  const settingsState = useSettingsState({ setError: data.setError });

  usePolling({
    refreshAll: data.refreshAll,
    refreshTaskDetail: tasksState.detail.refreshTaskDetail,
    selectedTaskId: tasksState.selection.selectedTaskId
  });

  useEffect(() => {
    if (tabState.activeTab !== 2) {
      return;
    }
    accountsState.refreshRateLimits().catch(() => {});
  }, [tabState.activeTab, accountsState.activeAccount?.id]);

  useEffect(() => {
    if (tabState.activeTab !== 3) {
      return;
    }
    settingsState.refreshImageInfo().catch(() => {});
  }, [tabState.activeTab]);

  return {
    accountsState,
    data,
    envState,
    settingsState,
    tabState,
    tasksState
  };
}

export default useAppState;
