const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { createFileUploadMiddleware } = require('../uploads');
const { serveArtifact } = require('./task-artifacts');
const { streamTaskLogs } = require('./task-logs');
const {
  createResumeTaskHandler,
  createRemoveTaskAttachmentsHandler,
  createTaskAttachmentsHandler,
  createTaskHandler
} = require('./task-handlers');

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

  router.post('/tasks/:taskId/resume', createResumeTaskHandler(orchestrator));

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

module.exports = {
  createTasksRouter
};
