const {
  normalizeAttachmentNamesInput,
  normalizeAttachmentUploadsInput,
  normalizeContextReposInput
} = require('../validators');

function normalizeResumeInput(body) {
  const { attachmentRemovals, fileUploads, prompt, model, reasoningEffort, useHostDockerSocket, contextRepos } = body;
  if (!prompt) {
    return { error: 'prompt is required' };
  }
  if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
    return { error: 'useHostDockerSocket must be a boolean' };
  }
  const hasContextOverride = Object.prototype.hasOwnProperty.call(body, 'contextRepos');
  const hasFileUploads = Object.prototype.hasOwnProperty.call(body, 'fileUploads');
  const hasAttachmentRemovals = Object.prototype.hasOwnProperty.call(body, 'attachmentRemovals');
  try {
    return {
      attachmentRemovals: hasAttachmentRemovals
        ? normalizeAttachmentNamesInput(attachmentRemovals, 'attachmentRemovals') || []
        : [],
      fileUploads: hasFileUploads ? normalizeAttachmentUploadsInput(fileUploads) || [] : [],
      hasAttachmentRemovals,
      hasContextOverride,
      hasFileUploads,
      model,
      prompt,
      reasoningEffort,
      contextRepos: hasContextOverride ? normalizeContextReposInput(contextRepos) : null,
      useHostDockerSocket
    };
  } catch (error) {
    return { error: error.message || 'Invalid task input' };
  }
}

function handleTaskMutationError(res, error) {
  if (error.code === 'TASK_BUSY') {
    res.status(409).send(error.message);
    return true;
  }
  if (error.code === 'INVALID_ATTACHMENT') {
    res.status(400).send(error.message);
    return true;
  }
  if (error.code === 'ENOENT') {
    res.status(404).send('Task not found');
    return true;
  }
  return false;
}

module.exports = {
  handleTaskMutationError,
  normalizeResumeInput
};
