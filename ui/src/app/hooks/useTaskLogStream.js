import { useEffect, useRef } from 'react';
import { apiUrl } from '../../api.js';

function useTaskLogStream({ selectedTaskId, taskDetail, setTaskDetail }) {
  const logStreamRef = useRef(null);

  useEffect(() => {
    if (!selectedTaskId || !taskDetail) {
      return;
    }
    if (taskDetail.status !== 'running' && taskDetail.status !== 'stopping') {
      if (logStreamRef.current) {
        logStreamRef.current.close();
        logStreamRef.current = null;
      }
      return;
    }
    const latestRun = taskDetail.runs?.[taskDetail.runs.length - 1];
    if (!latestRun) {
      return;
    }
    if (logStreamRef.current) {
      logStreamRef.current.close();
    }
    const eventSource = new EventSource(
      apiUrl(`/api/tasks/${selectedTaskId}/logs/stream?runId=${latestRun.runId}`)
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
  }, [selectedTaskId, setTaskDetail, taskDetail]);
}

export default useTaskLogStream;
