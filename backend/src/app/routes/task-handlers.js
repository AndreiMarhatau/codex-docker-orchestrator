const { asyncHandler } = require('../middleware/async-handler');
const { normalizeAttachmentUploadsInput, normalizeContextReposInput } = require('../validators');

function createTaskHandler(orchestrator) {
  return asyncHandler(async (req, res) => {
    const {
      envId,
      ref,
      prompt,
      imagePaths,
      fileUploads,
      model,
      reasoningEffort,
      useHostDockerSocket,
      repoReadOnly,
      contextRepos
    } = req.body;
    if (!envId || !prompt) {
      return res.status(400).send('envId and prompt are required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
    }
    if (repoReadOnly !== undefined && typeof repoReadOnly !== 'boolean') {
      return res.status(400).send('repoReadOnly must be a boolean');
    }
    let normalizedContextRepos = null;
    let normalizedFileUploads = null;
    try {
      normalizedContextRepos = normalizeContextReposInput(contextRepos);
      normalizedFileUploads = normalizeAttachmentUploadsInput(fileUploads);
    } catch (error) {
      return res.status(400).send(error.message || 'Invalid task input');
    }
    try {
      const task = await orchestrator.createTask({
        envId,
        ref,
        prompt,
        imagePaths,
        fileUploads: normalizedFileUploads,
        model,
        reasoningEffort,
        useHostDockerSocket,
        repoReadOnly,
        contextRepos: normalizedContextRepos
      });
      res.status(201).json(task);
    } catch (error) {
      if (error.code === 'INVALID_IMAGE') {
        return res.status(400).send(error.message);
      }
      if (error.code === 'INVALID_CONTEXT') {
        return res.status(400).send(error.message);
      }
      if (error.code === 'INVALID_ATTACHMENT') {
        return res.status(400).send(error.message);
      }
      throw error;
    }
  });
}

function createResumeTaskHandler(orchestrator) {
  return asyncHandler(async (req, res) => {
    const { prompt, model, reasoningEffort, useHostDockerSocket, repoReadOnly, contextRepos } =
      req.body;
    if (!prompt) {
      return res.status(400).send('prompt is required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
    }
    if (repoReadOnly !== undefined && typeof repoReadOnly !== 'boolean') {
      return res.status(400).send('repoReadOnly must be a boolean');
    }
    const hasContextOverride = Object.prototype.hasOwnProperty.call(req.body, 'contextRepos');
    let normalizedContextRepos = null;
    if (hasContextOverride) {
      try {
        normalizedContextRepos = normalizeContextReposInput(contextRepos);
      } catch (error) {
        return res.status(400).send(error.message || 'Invalid task input');
      }
    }
    const options = {
      model,
      reasoningEffort,
      useHostDockerSocket,
      repoReadOnly
    };
    if (hasContextOverride) {
      options.contextRepos = normalizedContextRepos;
    }
    const task = await orchestrator.resumeTask(req.params.taskId, prompt, options);
    res.json(task);
  });
}

function createTaskAttachmentsHandler(orchestrator, uploadFiles) {
  return (req, res, next) => {
    uploadFiles.array('files')(req, res, async (error) => {
      if (error) {
        return res.status(400).send(error.message || 'Upload failed.');
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).send('No files uploaded.');
      }
      try {
        const attachments = await orchestrator.addTaskAttachments(
          req.params.taskId,
          files.map((file) => ({
            path: file.path,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype
          }))
        );
        res.status(201).json({ attachments });
      } catch (err) {
        if (err.code === 'INVALID_ATTACHMENT') {
          return res.status(400).send(err.message);
        }
        if (err.code === 'ENOENT') {
          return res.status(404).send('Task not found');
        }
        return next(err);
      }
    });
  };
}

function createRemoveTaskAttachmentsHandler(orchestrator) {
  return asyncHandler(async (req, res) => {
    const { names } = req.body || {};
    try {
      const attachments = await orchestrator.removeTaskAttachments(req.params.taskId, names);
      res.json({ attachments });
    } catch (err) {
      if (err.code === 'INVALID_ATTACHMENT') {
        return res.status(400).send(err.message);
      }
      if (err.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw err;
    }
  });
}

module.exports = {
  createResumeTaskHandler,
  createRemoveTaskAttachmentsHandler,
  createTaskAttachmentsHandler,
  createTaskHandler
};
