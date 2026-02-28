import { useEffect } from 'react';

const isTestEnv = Boolean(import.meta.env.VITEST) || import.meta.env.MODE === 'test';

function usePolling({
  enabled = true,
  intervalMs = 8000,
  refreshAll,
  refreshTaskDetail,
  selectedTaskId
}) {
  useEffect(() => {
    if (!enabled || isTestEnv) {
      return undefined;
    }
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, refreshAll, refreshTaskDetail, selectedTaskId]);
}

export default usePolling;
