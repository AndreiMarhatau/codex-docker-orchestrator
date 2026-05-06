const fs = require('node:fs/promises');
const { asyncHandler } = require('../middleware/async-handler');
const { normalizeAttachmentUploadsInput, normalizeContextReposInput } = require('../validators');
const { finalizeStartedResumeStage, NOOP_RESUME_ATTACHMENT_STAGE, rollbackFailedResumeStage, stageResumeAttachments } = require('./tasks.resume-attachments');
const { handleTaskMutationError, normalizeResumeInput } = require('./tasks.resume-input');

function createTaskHandler(orchestrator) {
  return asyncHandler(async (req, res) => {
    const { envId, ref, prompt, fileUploads, model, reasoningEffort, useHostDockerSocket, autoReview, contextRepos, runAsGoal } = req.body;
    if (!envId || !prompt) {
      return res.status(400).send('envId and prompt are required');
    }
    if (useHostDockerSocket !== undefined && typeof useHostDockerSocket !== 'boolean') {
      return res.status(400).send('useHostDockerSocket must be a boolean');
    }
    if (autoReview !== undefined && typeof autoReview !== 'boolean') {
      return res.status(400).send('autoReview must be a boolean');
    }
    if (runAsGoal !== undefined && typeof runAsGoal !== 'boolean') {
      return res.status(400).send('runAsGoal must be a boolean');
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
        fileUploads: normalizedFileUploads,
        model,
        reasoningEffort,
        useHostDockerSocket,
        autoReview,
        runAsGoal,
        contextRepos: normalizedContextRepos,
        deferStartup: true
      });
      res.status(201).json(task);
    } catch (error) {
      if (error.code === 'INVALID_CONTEXT' || error.code === 'INVALID_ATTACHMENT') {
        return res.status(400).send(error.message);
      }
      throw error;
    }
  });
}

function createTaskAttachmentsHandler(orchestrator, uploadFiles) {
  return (req, res, next) => {
    uploadFiles.array('files')(req, res, async (uploadError) => {
      if (uploadError) {
        return res.status(400).send(uploadError.message || 'Upload failed.');
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
      } catch (error) {
        await Promise.allSettled(files.map((file) => fs.unlink(file.path)));
        if (error.code === 'INVALID_ATTACHMENT') {
          return res.status(400).send(error.message);
        }
        if (error.code === 'TASK_BUSY') {
          return res.status(409).send(error.message);
        }
        if (error.code === 'ENOENT') {
          return res.status(404).send('Task not found');
        }
        return next(error);
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
    } catch (error) {
      if (error.code === 'INVALID_ATTACHMENT') {
        return res.status(400).send(error.message);
      }
      if (error.code === 'TASK_BUSY') {
        return res.status(409).send(error.message);
      }
      if (error.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw error;
    }
  });
}

function createResumeTaskHandler(orchestrator) {
  return asyncHandler(async (req, res) => {
    const input = normalizeResumeInput(req.body);
    if (input.error) {
      return res.status(400).send(input.error);
    }
    let releaseTaskRunTransition = null;
    try {
      let existingTask = null;
      try {
        releaseTaskRunTransition = orchestrator.claimTaskRunTransition(req.params.taskId);
        existingTask = await orchestrator.getTask(req.params.taskId);
      } catch (error) {
        if (handleTaskMutationError(res, error)) {
          return;
        }
        throw error;
      }
      if (existingTask.status === 'running' || existingTask.status === 'stopping') {
        return res.status(409).send('Wait for the current run to finish before continuing this task.');
      }
      let stagedAttachments = NOOP_RESUME_ATTACHMENT_STAGE;
      try {
        stagedAttachments = await stageResumeAttachments(orchestrator, req.params.taskId, input);
        const options = {
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          runAsGoal: input.runAsGoal,
          clearGoal: input.clearGoal,
          useHostDockerSocket: input.useHostDockerSocket
        };
        if (input.hasContextOverride) {
          options.contextRepos = input.contextRepos;
        }
        options.transitionClaim = releaseTaskRunTransition;
        const task = await orchestrator.resumeTask(req.params.taskId, input.prompt, options).catch(async (error) => {
          await rollbackFailedResumeStage(stagedAttachments, error);
          throw error;
        });
        await finalizeStartedResumeStage(stagedAttachments, req.params.taskId);
        res.json(task);
      } catch (error) {
        if (handleTaskMutationError(res, error)) {
          return;
        }
        throw error;
      }
    } finally {
      releaseTaskRunTransition?.();
    }
  });
}

module.exports = { createRemoveTaskAttachmentsHandler, createResumeTaskHandler, createTaskAttachmentsHandler, createTaskHandler };
