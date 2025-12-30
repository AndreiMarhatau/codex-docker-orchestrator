import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyResumeConfig } from '../constants.js';
import useTaskLogStream from './useTaskLogStream.js';

function useTaskDetail({ tasks, selectedTaskId, setError, setSelectedTaskId }) {
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskDiff, setTaskDiff] = useState(null);
  const [revealedDiffs, setRevealedDiffs] = useState({});
  const [resumePrompt, setResumePrompt] = useState('');
  const [resumeConfig, setResumeConfig] = useState(emptyResumeConfig);
  const [resumeUseHostDockerSocket, setResumeUseHostDockerSocket] = useState(false);
  const [resumeDockerTouched, setResumeDockerTouched] = useState(false);
  const resumeDefaultsTaskIdRef = useRef('');

  const refreshTaskDetail = useCallback(
    async (taskId) => {
      if (!taskId) {
        return;
      }
      try {
        const detail = await apiRequest(`/api/tasks/${taskId}`);
        let diff = null;
        try {
          diff = await apiRequest(`/api/tasks/${taskId}/diff`);
        } catch (diffError) {
          if (diffError.status !== 404) {
            throw diffError;
          }
        }
        setTaskDetail(detail);
        setTaskDiff(diff);
      } catch (err) {
        if (err.status === 404) {
          setSelectedTaskId('');
          setTaskDetail(null);
          setTaskDiff(null);
          return;
        }
        throw err;
      }
    },
    [setSelectedTaskId]
  );

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      setTaskDiff(null);
      setRevealedDiffs({});
      setResumeConfig(emptyResumeConfig);
      return;
    }
    refreshTaskDetail(selectedTaskId).catch((err) => setError(err.message));
  }, [selectedTaskId, setError]);

  useEffect(() => {
    if (!selectedTaskId) {
      resumeDefaultsTaskIdRef.current = '';
      setResumeUseHostDockerSocket(false);
      setResumeDockerTouched(false);
      return;
    }
    if (resumeDefaultsTaskIdRef.current === selectedTaskId) {
      return;
    }
    const selectedTask = tasks.find((task) => task.taskId === selectedTaskId);
    if (!selectedTask) {
      return;
    }
    resumeDefaultsTaskIdRef.current = selectedTaskId;
    setResumeUseHostDockerSocket(selectedTask.useHostDockerSocket === true);
    setResumeDockerTouched(false);
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (!taskDetail || resumeDockerTouched) {
      return;
    }
    if (resumeDefaultsTaskIdRef.current !== taskDetail.taskId) {
      return;
    }
    setResumeUseHostDockerSocket(taskDetail.useHostDockerSocket === true);
  }, [taskDetail, resumeDockerTouched]);

  useTaskLogStream({ selectedTaskId, setTaskDetail, taskDetail });

  function revealDiff(path) {
    setRevealedDiffs((prev) => ({ ...prev, [path]: true }));
  }

  return {
    refreshTaskDetail,
    revealDiff,
    revealedDiffs,
    resumeConfig,
    resumeDockerTouched,
    resumePrompt,
    resumeUseHostDockerSocket,
    setResumeConfig,
    setResumeDockerTouched,
    setResumePrompt,
    setResumeUseHostDockerSocket,
    setTaskDetail,
    taskDetail,
    taskDiff
  };
}

export default useTaskDetail;
