import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyContextRepo } from '../constants.js';

function fillMissingRefForContextRepos(contextRepos, envs) {
  return contextRepos.map((repo) => {
    if (!repo.envId || repo.ref.trim()) {
      return repo;
    }
    const contextEnv = envs.find((entry) => entry.envId === repo.envId);
    if (!contextEnv) {
      return repo;
    }
    return {
      ...repo,
      ref: (contextEnv.defaultBranch || 'main').trim()
    };
  });
}

function useResumeContextRepos({ selectedTaskId, taskDetail, envs = [] }) {
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
    setResumeContextRepos(fillMissingRefForContextRepos(nextContext, envs));
    setResumeContextTouched(false);
  }, [envs, resumeContextTouched, taskDetail]);

  function handleAddResumeContextRepo() {
    setResumeContextRepos((prev) => [...prev, emptyContextRepo]);
    setResumeContextTouched(true);
  }

  function handleResumeContextRepoChange(index, field, value) {
    setResumeContextRepos((prev) => {
      const nextContextRepos = [...prev];
      const targetRepo = nextContextRepos[index] || emptyContextRepo;
      const nextRepo = { ...targetRepo };
      if (field === 'envId') {
        const contextEnv = envs.find((entry) => entry.envId === value);
        nextRepo[field] = value;
        nextRepo.ref = (contextEnv?.defaultBranch || 'main').trim();
      } else {
        nextRepo[field] = value;
      }
      if (index >= nextContextRepos.length) {
        if (!value) {
          return prev;
        }
        nextContextRepos.push(nextRepo);
      } else {
        nextContextRepos[index] = nextRepo;
      }
      return nextContextRepos;
    });
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
