import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_CUSTOM_VALUE, emptyContextRepo, emptyTaskForm } from '../constants.js';
import { getEffortOptionsForModel } from '../model-helpers.js';

function useTaskFormState({ envs, selectedTaskId, tasks }) {
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(false);
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
      setShowTaskForm(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    const isOpening = showTaskForm && !wasTaskFormOpen.current;
    wasTaskFormOpen.current = showTaskForm;
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
  }, [envs, latestTaskEnvId, showTaskForm]);

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
      const updated = prev.contextRepos.map((repo, idx) =>
        idx === index ? { ...repo, [field]: value } : repo
      );
      return { ...prev, contextRepos: updated };
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
    showTaskForm,
    taskForm,
    usedContextEnvIds
  };
}

export default useTaskFormState;
