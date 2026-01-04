import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyContextRepo } from '../constants.js';

function useResumeContextRepos({ selectedTaskId, taskDetail }) {
  const [resumeContextRepos, setResumeContextRepos] = useState([]);
  const [resumeContextTouched, setResumeContextTouched] = useState(false);
  const resumeContextDefaultsTaskIdRef = useRef('');

  const resumeUsedContextEnvIds = useMemo(
    () => resumeContextRepos.map((repo) => repo.envId).filter(Boolean),
    [resumeContextRepos]
  );

  useEffect(() => {
    if (!selectedTaskId) {
      resumeContextDefaultsTaskIdRef.current = '';
      setResumeContextRepos([]);
      setResumeContextTouched(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    if (!taskDetail) {
      return;
    }
    const isNewTask = resumeContextDefaultsTaskIdRef.current !== taskDetail.taskId;
    if (resumeContextTouched && !isNewTask) {
      return;
    }
    resumeContextDefaultsTaskIdRef.current = taskDetail.taskId;
    const nextContext = (taskDetail.contextRepos || []).map((repo) => ({
      envId: repo.envId || '',
      ref: repo.ref || ''
    }));
    setResumeContextRepos(nextContext);
    setResumeContextTouched(false);
  }, [resumeContextTouched, taskDetail]);

  function handleAddResumeContextRepo() {
    setResumeContextRepos((prev) => [...prev, emptyContextRepo]);
    setResumeContextTouched(true);
  }

  function handleResumeContextRepoChange(index, field, value) {
    setResumeContextRepos((prev) =>
      prev.map((repo, idx) => (idx === index ? { ...repo, [field]: value } : repo))
    );
    setResumeContextTouched(true);
  }

  function handleRemoveResumeContextRepo(index) {
    setResumeContextRepos((prev) => prev.filter((_, idx) => idx !== index));
    setResumeContextTouched(true);
  }

  return {
    handleAddResumeContextRepo,
    handleRemoveResumeContextRepo,
    handleResumeContextRepoChange,
    resumeContextRepos,
    resumeContextTouched,
    resumeUsedContextEnvIds,
    setResumeContextRepos,
    setResumeContextTouched
  };
}

export default useResumeContextRepos;
