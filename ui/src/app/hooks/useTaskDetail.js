import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyResumeConfig } from '../constants.js';
import useResumeContextRepos from './useResumeContextRepos.js';
import useTaskFiles from './useTaskFiles.js';
import useTaskLogStream from './useTaskLogStream.js';
import {
  applyResumeDefaultsFromTask,
  createRevealDiff,
  createToggleResumeAttachmentRemoval,
  resetResumeDefaults,
  resetTaskSelectionState
} from './task-detail-helpers.js';
function useTaskDetail({ tasks, selectedTaskId, setError, setSelectedTaskId }) {
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskDiff, setTaskDiff] = useState(null);
  const [revealedDiffs, setRevealedDiffs] = useState({});
  const [resumePrompt, setResumePrompt] = useState('');
  const [resumeConfig, setResumeConfig] = useState(emptyResumeConfig);
  const [resumeUseHostDockerSocket, setResumeUseHostDockerSocket] = useState(false);
  const [resumeDockerTouched, setResumeDockerTouched] = useState(false);
  const [resumeRepoReadOnly, setResumeRepoReadOnly] = useState(false);
  const [resumeRepoReadOnlyTouched, setResumeRepoReadOnlyTouched] = useState(false);
  const resumeFiles = useTaskFiles();
  const [resumeAttachmentRemovals, setResumeAttachmentRemovals] = useState([]);
  const resumeDefaultsTaskIdRef = useRef('');
  const resumeContextState = useResumeContextRepos({ selectedTaskId, taskDetail });

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
      resetTaskSelectionState({
        setTaskDetail,
        setTaskDiff,
        setRevealedDiffs,
        setResumeConfig,
        resumeFiles,
        setResumeAttachmentRemovals
      });
      return;
    }
    refreshTaskDetail(selectedTaskId).catch((err) => setError(err.message));
  }, [selectedTaskId, setError]);

  useEffect(() => {
    if (!selectedTaskId) {
      resetResumeDefaults({
        resumeDefaultsTaskIdRef,
        setResumeUseHostDockerSocket,
        setResumeDockerTouched,
        setResumeRepoReadOnly,
        setResumeRepoReadOnlyTouched,
        resumeFiles,
        setResumeAttachmentRemovals
      });
      return;
    }
    applyResumeDefaultsFromTask({
      selectedTaskId,
      tasks,
      resumeDefaultsTaskIdRef,
      setResumeUseHostDockerSocket,
      setResumeDockerTouched,
      setResumeRepoReadOnly,
      setResumeRepoReadOnlyTouched
    });
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

  useEffect(() => {
    if (!taskDetail || resumeRepoReadOnlyTouched) {
      return;
    }
    if (resumeDefaultsTaskIdRef.current !== taskDetail.taskId) {
      return;
    }
    setResumeRepoReadOnly(taskDetail.repoReadOnly === true);
  }, [taskDetail, resumeRepoReadOnlyTouched]);

  useTaskLogStream({ selectedTaskId, setTaskDetail, taskDetail });

  const revealDiff = createRevealDiff(setRevealedDiffs);
  const toggleResumeAttachmentRemoval = createToggleResumeAttachmentRemoval(
    setResumeAttachmentRemovals
  );

  return {
    refreshTaskDetail,
    revealDiff,
    revealedDiffs,
    resumeAttachmentRemovals,
    resumeConfig,
    resumeDockerTouched,
    resumeFiles,
    resumePrompt,
    resumeRepoReadOnly,
    resumeRepoReadOnlyTouched,
    resumeUseHostDockerSocket,
    setResumeAttachmentRemovals,
    setResumeConfig,
    setResumeDockerTouched,
    setResumePrompt,
    setResumeRepoReadOnly,
    setResumeRepoReadOnlyTouched,
    setResumeUseHostDockerSocket,
    setTaskDetail,
    taskDetail,
    taskDiff,
    toggleResumeAttachmentRemoval,
    ...resumeContextState
  };
}

export default useTaskDetail;
