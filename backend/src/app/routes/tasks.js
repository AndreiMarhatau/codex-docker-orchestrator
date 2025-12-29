const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { normalizeContextReposInput } = require('../validators');
const { serveArtifact } = require('./task-artifacts');
const { streamTaskLogs } = require('./task-logs');

function createTasksRouter(orchestrator) {
  const router = express.Router();

  router.get('/tasks', asyncHandler(async (req, res) => {
    const tasks = await orchestrator.listTasks();
    res.json(tasks);
  }));

  router.post('/tasks', asyncHandler(async (req, res) => {
    const {
      envId,
      ref,
      prompt,
      imagePaths,
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
    try {
      normalizedContextRepos = normalizeContextReposInput(contextRepos);
    } catch (error) {
      return res.status(400).send(error.message || 'Invalid contextRepos');
    }
    try {
      const task = await orchestrator.createTask({
        envId,
        ref,
        prompt,
        imagePaths,
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
      throw error;
    }
  }));

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
    const { prompt, model, reasoningEffort, useHostDockerSocket } = req.body;
    if (!prompt) {
      return res.status(400).send('prompt is required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
    }
    const task = await orchestrator.resumeTask(req.params.taskId, prompt, {
      model,
      reasoningEffort,
      useHostDockerSocket
    });
    res.json(task);
  }));

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
