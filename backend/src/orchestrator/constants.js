const path = require('node:path');
const os = require('node:os');

const DEFAULT_ORCH_HOME = path.join(os.homedir(), '.codex-orchestrator');
const DEFAULT_IMAGE_NAME = 'ghcr.io/andreimarhatau/codex-docker:latest';
const DEFAULT_ORCH_AGENTS_FILE = path.join(__dirname, '..', '..', '..', 'ORCHESTRATOR_AGENTS.md');
const DEFAULT_HOST_DOCKER_AGENTS_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'ORCHESTRATOR_AGENTS_HOST_DOCKER.md'
);
const COMMIT_SHA_REGEX = /^[0-9a-f]{7,40}$/i;
const DEFAULT_GIT_CREDENTIAL_HELPER = '!/usr/bin/gh auth git-credential';
const DEFAULT_ACCOUNT_ROTATION_LIMIT = 'auto';
const MAX_DIFF_LINES = 400;

module.exports = {
  DEFAULT_ORCH_HOME,
  DEFAULT_IMAGE_NAME,
  DEFAULT_ORCH_AGENTS_FILE,
  DEFAULT_HOST_DOCKER_AGENTS_FILE,
  COMMIT_SHA_REGEX,
  DEFAULT_GIT_CREDENTIAL_HELPER,
  DEFAULT_ACCOUNT_ROTATION_LIMIT,
  MAX_DIFF_LINES
};
