const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { normalizeAttachmentUploadsInput, normalizeContextReposInput } = require('../validators');
const { createFileUploadMiddleware } = require('../uploads');
const { serveArtifact } = require('./task-artifacts');
const { streamTaskLogs } = require('./task-logs');

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
      contextRepos
    } = req.body;
    if (!envId || !prompt) {
      return res.status(400).send('envId and prompt are required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
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
        if (typeof orchestrator.emitStateEvent === 'function') {
          orchestrator.emitStateEvent('tasks_changed', { taskId: req.params.taskId });
        }
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
      if (typeof orchestrator.emitStateEvent === 'function') {
        orchestrator.emitStateEvent('tasks_changed', { taskId: req.params.taskId });
      }
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

function createTasksRouter(orchestrator) {
  const router = express.Router();
  const uploadFiles = createFileUploadMiddleware(orchestrator);

  router.get('/tasks', asyncHandler(async (req, res) => {
    const tasks = await orchestrator.listTasks();
    res.json(tasks);
  }));

  router.post('/tasks', createTaskHandler(orchestrator));

  router.get('/tasks/:taskId', asyncHandler(async (req, res) => {
    try {
      const task = await orchestrator.getTask(req.params.taskId);
      res.json(task);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw error;
    }
  }));

  router.get('/tasks/:taskId/diff', asyncHandler(async (req, res) => {
    try {
      const diff = await orchestrator.getTaskDiff(req.params.taskId);
      res.json(diff);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw error;
    }
  }));

  router.get('/tasks/:taskId/artifacts/:runId/*', asyncHandler(async (req, res) => {
    await serveArtifact(orchestrator, req, res);
  }));

  router.post('/tasks/:taskId/resume', asyncHandler(async (req, res) => {
    const { prompt, model, reasoningEffort, useHostDockerSocket, contextRepos } = req.body;
    if (!prompt) {
      return res.status(400).send('prompt is required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
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
      useHostDockerSocket
    };
    if (hasContextOverride) {
      options.contextRepos = normalizedContextRepos;
    }
    const task = await orchestrator.resumeTask(req.params.taskId, prompt, options);
    res.json(task);
  }));

  router.post(
    '/tasks/:taskId/attachments',
    createTaskAttachmentsHandler(orchestrator, uploadFiles)
  );

  router.delete('/tasks/:taskId/attachments', createRemoveTaskAttachmentsHandler(orchestrator));

  router.post('/tasks/:taskId/stop', asyncHandler(async (req, res) => {
    const task = await orchestrator.stopTask(req.params.taskId);
    res.json(task);
  }));

  router.get('/tasks/:taskId/logs/stream', (req, res) => {
    streamTaskLogs(orchestrator, req, res);
  });

  router.post('/tasks/:taskId/push', asyncHandler(async (req, res) => {
    const result = await orchestrator.pushTask(req.params.taskId);
    res.json(result);
  }));

  router.delete('/tasks/:taskId', asyncHandler(async (req, res) => {
    await orchestrator.deleteTask(req.params.taskId);
    res.status(204).send();
  }));

  return router;
}

module.exports = { createTasksRouter };
