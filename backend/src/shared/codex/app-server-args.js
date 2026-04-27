const CODEX_APP_SERVER_ARGS = [
  '-c',
  'sandbox_mode="danger-full-access"',
  '-c',
  'approval_policy="never"',
  'app-server'
];

function buildCodexAppServerArgs() {
  return [...CODEX_APP_SERVER_ARGS];
}

function isCodexAppServerArgs(args) {
  return Array.isArray(args) && args.includes('app-server');
}

module.exports = {
  CODEX_APP_SERVER_ARGS,
  buildCodexAppServerArgs,
  isCodexAppServerArgs
};
