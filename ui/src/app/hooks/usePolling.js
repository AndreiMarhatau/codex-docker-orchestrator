import { useEffect } from 'react';

const isTestEnv = Boolean(import.meta.env.VITEST) || import.meta.env.MODE === 'test';

function usePolling({ enabled = true, refreshAll, refreshTaskDetail, selectedTaskId }) {
  useEffect(() => {
    if (!enabled || isTestEnv) {
      return undefined;
    }
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [enabled, refreshAll, refreshTaskDetail, selectedTaskId]);
}

export default usePolling;
