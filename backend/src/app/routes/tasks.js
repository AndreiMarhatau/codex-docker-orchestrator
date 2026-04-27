const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { createFileUploadMiddleware } = require('../uploads');
const { serveArtifact } = require('./task-artifacts');
const { streamTaskLogs } = require('./task-logs');
const {
  createRemoveTaskAttachmentsHandler,
  createResumeTaskHandler,
  createTaskAttachmentsHandler,
  createTaskHandler
} = require('./tasks.handlers');

function sendTaskMutationError(res, error) {
  if (error.code === 'TASK_BUSY') {
    res.status(409).send(error.message);
    return true;
  }
  if (error.code === 'ENOENT') {
    res.status(404).send('Task not found');
    return true;
  }
  return false;
}

function createMissingTaskHandler(load) {
  return asyncHandler(async (req, res) => {
    try {
      const value = await load(req.params.taskId);
      res.json(value);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw error;
    }
  });
}

function createTaskMutationRoute(runMutation, sendResult = (res, value) => res.json(value)) {
  return asyncHandler(async (req, res) => {
    try {
      const value = await runMutation(req);
      sendResult(res, value);
    } catch (error) {
      if (!sendTaskMutationError(res, error)) {
        throw error;
      }
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
  router.get('/tasks/:taskId', createMissingTaskHandler((taskId) => orchestrator.getTask(taskId)));
  router.get(
    '/tasks/:taskId/diff',
    createMissingTaskHandler((taskId) => orchestrator.getTaskDiff(taskId))
  );
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
  router.post(
    '/tasks/:taskId/push',
    createTaskMutationRoute((req) => orchestrator.pushTask(req.params.taskId))
  );
  router.post(
    '/tasks/:taskId/commit-push',
    createTaskMutationRoute((req) =>
      orchestrator.commitAndPushTask(req.params.taskId, {
        message: req.body?.message
      })
    )
  );
  router.post(
    '/tasks/:taskId/review',
    createTaskMutationRoute(
      (req) => orchestrator.startTaskReview(req.params.taskId, req.body || {}),
      (res, value) => res.status(202).json(value)
    )
  );
  router.delete('/tasks/:taskId', createTaskMutationRoute(
    (req) => orchestrator.deleteTask(req.params.taskId),
    (res) => {
      res.status(204).send();
    }
  ));

  return router;
}

module.exports = { createTasksRouter };
