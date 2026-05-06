const { STATE_EVENT_TYPES } = require('../app/state-event-types');
const { createDockerCommandRunner } = require('../shared/docker/commands');

const CODEX_IMAGE_STATUSES = Object.freeze({
  unknown: 'unknown',
  checking: 'checking',
  pulling: 'pulling',
  ready: 'ready',
  failed: 'failed'
});

function createInitialCodexImageState(imageName, now) {
  return {
    imageName,
    status: CODEX_IMAGE_STATUSES.unknown,
    ready: false,
    message: 'Codex runtime image has not been checked yet.',
    imageId: null,
    createdAt: null,
    startedAt: null,
    updatedAt: now(),
    error: null
  };
}

function parseImageInspectOutput(stdout) {
  const [imageId, createdAt] = String(stdout || '').trim().split('|');
  return {
    imageId: imageId || null,
    createdAt: createdAt || null
  };
}

function createCodexImageRunner(orchestrator) {
  return createDockerCommandRunner({
    exec: (args, options) => orchestrator.exec('docker', args, options),
    timeoutMs: orchestrator.taskDockerCommandTimeoutMs
  });
}

async function inspectCodexImage(imageName, runner, execOptions) {
  const result = await runner.run([
    'image',
    'inspect',
    '--format',
    '{{.Id}}|{{.Created}}',
    imageName
  ], execOptions);
  if (result.code !== 0) {
    return null;
  }
  return parseImageInspectOutput(result.stdout);
}

function createAbortError() {
  const error = new Error('Codex runtime image preparation was cancelled.');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function waitForCodexImagePull(promise, signal) {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

async function prepareCodexImage(orchestrator, runner, imageName) {
  orchestrator.setCodexImageState({
    status: CODEX_IMAGE_STATUSES.checking,
    ready: false,
    message: `Checking Codex runtime image ${imageName}.`,
    startedAt: orchestrator.codexImageStates?.get(imageName)?.startedAt || orchestrator.now(),
    error: null
  }, imageName);
  const existing = await inspectCodexImage(imageName, runner, {});
  if (existing) {
    orchestrator.markCodexImageReady(existing, imageName);
    return;
  }
  orchestrator.setCodexImageState({
    status: CODEX_IMAGE_STATUSES.pulling,
    ready: false,
    message: `Pulling Codex runtime image ${imageName}.`,
    error: null
  }, imageName);
  await runner.runOrThrow(['pull', imageName]);
  const pulled = await inspectCodexImage(imageName, runner, {});
  orchestrator.markCodexImageReady(pulled || {}, imageName);
}

function attachCodexImageMethods(Orchestrator) {
  Orchestrator.prototype.getCodexImageStatus = function getCodexImageStatus(imageName = null) {
    const state = imageName ? this.codexImageStates?.get(imageName) : this.codexImageState;
    return { ...(state || createInitialCodexImageState(imageName || this.imageName, this.now)) };
  };

  Orchestrator.prototype.setCodexImageState = function setCodexImageState(
    patch,
    imageName = this.imageName
  ) {
    const nextState = {
      ...this.getCodexImageStatus(imageName),
      ...patch,
      imageName,
      updatedAt: this.now()
    };
    this.codexImageStates.set(imageName, nextState);
    this.codexImageState = nextState;
    this.emitStateEventSafe(STATE_EVENT_TYPES.codexImageChanged, {
      codexImage: this.getCodexImageStatus()
    });
  };

  Orchestrator.prototype.markCodexImageReady = function markCodexImageReady(
    inspect,
    imageName = this.imageName
  ) {
    this.setCodexImageState({
      status: CODEX_IMAGE_STATUSES.ready,
      ready: true,
      message: 'Codex runtime image is ready.',
      imageId: inspect?.imageId || null,
      createdAt: inspect?.createdAt || null,
      error: null
    }, imageName);
  };

  Orchestrator.prototype.ensureCodexImageReady = async function ensureCodexImageReady(execOptions = {}) {
    const imageName = String(execOptions.imageName || this.imageName || '').trim();
    if (execOptions.signal?.aborted) {
      throw createAbortError();
    }
    const imageState = this.codexImageStates.get(imageName);
    if (imageState?.ready) {
      return this.getCodexImageStatus(imageName);
    }
    if (!this.codexImagePullPromises.has(imageName)) {
      const runner = createCodexImageRunner(this);
      const pullPromise = prepareCodexImage(this, runner, imageName).catch((error) => {
        this.setCodexImageState({
          status: CODEX_IMAGE_STATUSES.failed,
          ready: false,
          message: `Failed to prepare Codex runtime image ${imageName}.`,
          error: error?.message || 'Docker image pull failed.'
        }, imageName);
        throw error;
      }).finally(() => {
        if (this.codexImagePullPromises.get(imageName) === pullPromise) {
          this.codexImagePullPromises.delete(imageName);
        }
      });
      this.codexImagePullPromises.set(imageName, pullPromise);
      void pullPromise.catch(() => {});
    }
    await waitForCodexImagePull(this.codexImagePullPromises.get(imageName), execOptions.signal);
    return this.getCodexImageStatus(imageName);
  };

  Orchestrator.prototype.warmCodexImage = function warmCodexImage() {
    void this.ensureCodexImageReady().catch(() => {});
  };
}

module.exports = {
  CODEX_IMAGE_STATUSES,
  attachCodexImageMethods,
  createInitialCodexImageState
};
