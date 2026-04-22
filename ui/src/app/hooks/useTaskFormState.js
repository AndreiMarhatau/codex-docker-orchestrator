import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_CUSTOM_VALUE, emptyContextRepo, emptyTaskForm } from '../constants.js';
import { getEffortOptionsForModel } from '../model-helpers.js';
import { readComposeQuery, writeComposeQuery } from '../query-state.js';

function useTaskFormState({ envs, selectedTaskId, tasks }) {
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [showTaskFormState, setShowTaskFormState] = useState(() => readComposeQuery() === 'create');
  const wasTaskFormOpen = useRef(false);

  const latestTaskEnvId = useMemo(() => {
    if (!tasks.length) {
      return '';
    }
    const sortedTasks = tasks
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return sortedTasks.find((task) => task.envId)?.envId || '';
  }, [tasks]);

  const usedContextEnvIds = useMemo(
    () => taskForm.contextRepos.map((repo) => repo.envId).filter(Boolean),
    [taskForm.contextRepos]
  );

  useEffect(() => {
    if (selectedTaskId) {
      setShowTaskFormState(false);
      if (readComposeQuery() === 'create') {
        writeComposeQuery('');
      }
    }
  }, [selectedTaskId]);

  useEffect(() => {
    const isOpening = showTaskFormState && !wasTaskFormOpen.current;
    wasTaskFormOpen.current = showTaskFormState;
    if (!isOpening) {
      return;
    }
    if (envs.length === 0) {
      return;
    }
    const defaultEnvId =
      latestTaskEnvId && envs.some((env) => env.envId === latestTaskEnvId)
        ? latestTaskEnvId
        : envs[0].envId;
    setTaskForm((prev) => (prev.envId === defaultEnvId ? prev : { ...prev, envId: defaultEnvId }));
  }, [envs, latestTaskEnvId, showTaskFormState]);

  function setShowTaskForm(value) {
    setShowTaskFormState((prev) => {
      const nextValue = typeof value === 'function' ? Boolean(value(prev)) : Boolean(value);
      writeComposeQuery(nextValue ? 'create' : '');
      return nextValue;
    });
  }

  function handleTaskModelChoiceChange(value) {
    setTaskForm((prev) => {
      const next = { ...prev, modelChoice: value };
      if (!value) {
        next.reasoningEffort = '';
        return next;
      }
      if (value !== MODEL_CUSTOM_VALUE) {
        const supportedEfforts = getEffortOptionsForModel(value);
        if (next.reasoningEffort && !supportedEfforts.includes(next.reasoningEffort)) {
          next.reasoningEffort = '';
        }
      }
      return next;
    });
  }

  function handleAddContextRepo() {
    if (envs.length === 0) {
      return;
    }
    if (usedContextEnvIds.length >= envs.length) {
      return;
    }
    setTaskForm((prev) => ({
      ...prev,
      contextRepos: [...prev.contextRepos, emptyContextRepo]
    }));
  }

  function handleContextRepoChange(index, field, value) {
    setTaskForm((prev) => {
      const contextRepos = [...prev.contextRepos];
      const targetRepo = contextRepos[index] || emptyContextRepo;
      const nextRepo = { ...targetRepo };
      if (field === 'envId') {
        const contextEnv = envs.find((env) => env.envId === value);
        nextRepo[field] = value;
        nextRepo.ref = (contextEnv?.defaultBranch || 'main').trim();
      } else {
        nextRepo[field] = value;
      }
      if (index >= contextRepos.length) {
        if (!value) {
          return prev;
        }
        contextRepos.push(nextRepo);
      } else {
        contextRepos[index] = nextRepo;
      }
      return { ...prev, contextRepos };
    });
  }

  function handleRemoveContextRepo(index) {
    setTaskForm((prev) => ({
      ...prev,
      contextRepos: prev.contextRepos.filter((_, idx) => idx !== index)
    }));
  }

  return {
    handleAddContextRepo,
    handleContextRepoChange,
    handleRemoveContextRepo,
    handleTaskModelChoiceChange,
    setShowTaskForm,
    setTaskForm,
    showTaskForm: showTaskFormState,
    taskForm,
    usedContextEnvIds
  };
}

export default useTaskFormState;
