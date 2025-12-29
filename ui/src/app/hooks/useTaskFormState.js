import { useEffect, useMemo, useState } from 'react';
import { MODEL_CUSTOM_VALUE, emptyContextRepo, emptyTaskForm } from '../constants.js';
import { getEffortOptionsForModel } from '../model-helpers.js';

function useTaskFormState({ envs, selectedTaskId }) {
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const usedContextEnvIds = useMemo(
    () => taskForm.contextRepos.map((repo) => repo.envId).filter(Boolean),
    [taskForm.contextRepos]
  );

  useEffect(() => {
    if (selectedTaskId) {
      setShowTaskForm(false);
    }
  }, [selectedTaskId]);

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
