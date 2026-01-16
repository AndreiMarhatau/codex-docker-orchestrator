import { emptyResumeConfig } from '../constants.js';

function resetTaskSelectionState({
  setTaskDetail,
  setTaskDiff,
  setRevealedDiffs,
  setResumeConfig,
  resumeFiles,
  setResumeAttachmentRemovals
}) {
  setTaskDetail(null);
  setTaskDiff(null);
  setRevealedDiffs({});
  setResumeConfig(emptyResumeConfig);
  resumeFiles.handleClearTaskFiles();
  setResumeAttachmentRemovals([]);
}

function resetResumeDefaults({
  resumeDefaultsTaskIdRef,
  setResumeUseHostDockerSocket,
  setResumeDockerTouched,
  setResumeRepoReadOnly,
  setResumeRepoReadOnlyTouched,
  resumeFiles,
  setResumeAttachmentRemovals
}) {
  resumeDefaultsTaskIdRef.current = '';
  setResumeUseHostDockerSocket(false);
  setResumeDockerTouched(false);
  setResumeRepoReadOnly(false);
  setResumeRepoReadOnlyTouched(false);
  resumeFiles.handleClearTaskFiles();
  setResumeAttachmentRemovals([]);
}

function applyResumeDefaultsFromTask({
  selectedTaskId,
  tasks,
  resumeDefaultsTaskIdRef,
  setResumeUseHostDockerSocket,
  setResumeDockerTouched,
  setResumeRepoReadOnly,
  setResumeRepoReadOnlyTouched
}) {
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
  setResumeRepoReadOnly(selectedTask.repoReadOnly === true);
  setResumeRepoReadOnlyTouched(false);
}

function createRevealDiff(setRevealedDiffs) {
  return function revealDiff(path) {
    setRevealedDiffs((prev) => ({ ...prev, [path]: true }));
  };
}

function createToggleResumeAttachmentRemoval(setResumeAttachmentRemovals) {
  return function toggleResumeAttachmentRemoval(name) {
    setResumeAttachmentRemovals((prev) => {
      if (prev.includes(name)) {
        return prev.filter((entry) => entry !== name);
      }
      return [...prev, name];
    });
  };
}

export {
  applyResumeDefaultsFromTask,
  createRevealDiff,
  createToggleResumeAttachmentRemoval,
  resetResumeDefaults,
  resetTaskSelectionState
};
