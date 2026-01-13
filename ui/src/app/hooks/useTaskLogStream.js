import { useEffect, useMemo, useRef } from 'react';
import { apiUrlWithPassword } from '../../api.js';

function useTaskLogStream({ selectedTaskId, taskDetail, setTaskDetail }) {
  const logStreamRef = useRef(null);
  const latestRunId = useMemo(
    () => taskDetail?.runs?.[taskDetail.runs.length - 1]?.runId || '',
    [taskDetail?.runs]
  );
  const status = taskDetail?.status || '';

  useEffect(() => {
    if (!selectedTaskId || !status) {
      return;
    }
    if (status !== 'running' && status !== 'stopping') {
      if (logStreamRef.current) {
        logStreamRef.current.close();
        logStreamRef.current = null;
      }
      return;
    }
    if (!latestRunId) {
      return;
    }
    if (logStreamRef.current) {
      logStreamRef.current.close();
    }
    const eventSource = new EventSource(
      apiUrlWithPassword(`/api/tasks/${selectedTaskId}/logs/stream?runId=${latestRunId}`)
    );
    logStreamRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { runId, entry } = payload;
        if (!runId || !entry) {
          return;
        }
        setTaskDetail((prev) => {
          if (!prev) {
            return prev;
          }
          const runLogs = prev.runLogs ? [...prev.runLogs] : [];
          const runIndex = runLogs.findIndex((run) => run.runId === runId);
          if (runIndex === -1) {
            return prev;
          }
          const run = runLogs[runIndex];
          const entries = run.entries ? [...run.entries] : [];
          entries.push(entry);
          const updatedRun = { ...run, entries };
          runLogs[runIndex] = updatedRun;
          return { ...prev, runLogs };
        });
      } catch (err) {
        return;
      }
    };
    return () => {
      eventSource.close();
      if (logStreamRef.current === eventSource) {
        logStreamRef.current = null;
      }
    };
  }, [latestRunId, selectedTaskId, setTaskDetail, status]);
}

export default useTaskLogStream;
