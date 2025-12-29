const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { runCommand } = require('./commands');
const { AccountStore } = require('./accounts');
const {
  ensureDir,
  writeJson,
  readJson,
  writeText,
  readText,
  listDirs,
  pathExists,
  removePath
} = require('./storage');

const DEFAULT_ORCH_HOME = path.join(os.homedir(), '.codex-orchestrator');
const DEFAULT_IMAGE_NAME = 'ghcr.io/andreimarhatau/codex-docker:latest';
const DEFAULT_ORCH_AGENTS_FILE = path.join(__dirname, '..', '..', 'ORCHESTRATOR_AGENTS.md');
const DEFAULT_HOST_DOCKER_AGENTS_FILE = path.join(
  __dirname,
  '..',
  '..',
  'ORCHESTRATOR_AGENTS_HOST_DOCKER.md'
);
const COMMIT_SHA_REGEX = /^[0-9a-f]{7,40}$/i;
const DEFAULT_GIT_CREDENTIAL_HELPER = '!/usr/bin/gh auth git-credential';
const DEFAULT_ACCOUNT_ROTATION_LIMIT = 'auto';

function invalidImageError(message) {
  const error = new Error(message);
  error.code = 'INVALID_IMAGE';
  return error;
}

function invalidContextError(message) {
  const error = new Error(message);
  error.code = 'INVALID_CONTEXT';
  return error;
}

function noActiveAccountError(message) {
  const error = new Error(message);
  error.code = 'NO_ACTIVE_ACCOUNT';
  return error;
}

async function resolveRefInRepo(execOrThrow, gitDir, ref) {
  if (!ref) return ref;
  if (ref.startsWith('refs/')) return ref;
  if (ref.startsWith('origin/')) return `refs/remotes/${ref}`;
  if (COMMIT_SHA_REGEX.test(ref)) return ref;
  try {
    await execOrThrow('git', ['--git-dir', gitDir, 'show-ref', '--verify', `refs/tags/${ref}`]);
    return `refs/tags/${ref}`;
  } catch (error) {
    return `refs/remotes/origin/${ref}`;
  }
}

function parseThreadId(jsonl) {
  const lines = jsonl.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      if (payload.type === 'thread.started' && payload.thread_id) {
        return payload.thread_id;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function repoNameFromUrl(repoUrl) {
  const trimmed = String(repoUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'worktree';
  let pathname = trimmed;
  if (trimmed.includes('://')) {
    try {
      pathname = new URL(trimmed).pathname || trimmed;
    } catch (error) {
      pathname = trimmed;
    }
  } else if (trimmed.includes(':') && !trimmed.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
    pathname = trimmed.split(':').slice(-1)[0];
  }
  const parts = pathname.split(/[\\/]/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return 'worktree';
  return last.replace(/\.git$/i, '') || 'worktree';
}

function nextRunLabel(runCount) {
  return `run-${String(runCount).padStart(3, '0')}`;
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function parseLogEntries(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    const parsed = safeJsonParse(line);
    return {
      id: `log-${index + 1}`,
      type: parsed && parsed.type ? parsed.type : 'text',
      raw: line,
      parsed
    };
  });
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isUsageLimitError(output) {
  if (!output) return false;
  const lower = output.toLowerCase();
  if (lower.includes("you've hit your usage limit")) return true;
  if (lower.includes('usage limit') && lower.includes('codex')) return true;
  if (lower.includes('usage limit') && lower.includes('chatgpt')) return true;
  return false;
}

function buildContextReposSection(contextRepos) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) return '';
  const lines = [
    '# Read-only reference repositories',
    '',
    'The following repositories are mounted read-only for context:',
    ...contextRepos.map((repo) => {
      const repoLabel = repo.repoUrl || repo.envId || 'unknown';
      const refLabel = repo.ref ? ` (${repo.ref})` : '';
      return `- ${repoLabel}${refLabel} at ${repo.worktreePath}`;
    }),
    '',
    'Do not modify these paths; treat them as read-only references.'
  ];
  return lines.join('\n');
}

function buildCodexArgs({ prompt, model, reasoningEffort, imageArgs = [], resumeThreadId }) {
  const args = ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json'];
  if (model) {
    args.push('--model', model);
  }
  if (reasoningEffort) {
    args.push('-c', `model_reasoning_effort=${reasoningEffort}`);
  }
  if (resumeThreadId) {
    args.push('resume', resumeThreadId, prompt);
    return args;
  }
  args.push(...imageArgs, prompt);
  return args;
}

const MAX_DIFF_LINES = 400;

function normalizeDiffPath(aPath, bPath) {
  if (bPath === 'dev/null') return aPath;
  if (aPath === 'dev/null') return bPath;
  return bPath;
}

function parseUnifiedDiff(diffText) {
  if (!diffText) return [];
  const lines = diffText.split('\n');
  const files = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current) {
        const trimmed = current.diff.trimEnd();
        const lineCount = trimmed ? trimmed.split('\n').length : 0;
        files.push({
          ...current,
          lineCount,
          tooLarge: lineCount > MAX_DIFF_LINES
        });
      }
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      const aPath = match ? match[1] : 'unknown';
      const bPath = match ? match[2] : aPath;
      current = {
        path: normalizeDiffPath(aPath, bPath),
        diff: `${line}\n`
      };
      continue;
    }
    if (current) {
      current.diff += `${line}\n`;
    }
  }
  if (current) {
    const trimmed = current.diff.trimEnd();
    const lineCount = trimmed ? trimmed.split('\n').length : 0;
    files.push({
      ...current,
      lineCount,
      tooLarge: lineCount > MAX_DIFF_LINES
    });
  }
  return files;
}

async function listArtifacts(rootDir) {
  if (!(await pathExists(rootDir))) return [];
  const artifacts = [];
  const pending = [rootDir];
  while (pending.length > 0) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (entry.isFile()) {
        try {
          const stat = await fsp.stat(entryPath);
          artifacts.push({
            path: path.relative(rootDir, entryPath),
            size: stat.size
          });
        } catch (error) {
          continue;
        }
      }
    }
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  return artifacts;
}

class Orchestrator {
  constructor(options = {}) {
    this.orchHome = options.orchHome || process.env.ORCH_HOME || DEFAULT_ORCH_HOME;
    this.codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const baseExec = options.exec || runCommand;
    this.exec = (command, args, execOptions = {}) => {
      if (command === 'git') {
        const gitArgs = this.withGitCredentialHelper(args);
        return baseExec(command, gitArgs, execOptions);
      }
      return baseExec(command, args, execOptions);
    };
    this.spawn = options.spawn || spawn;
    this.now = options.now || (() => new Date().toISOString());
    this.fetch = options.fetch || global.fetch;
    this.imageName = options.imageName || process.env.IMAGE_NAME || DEFAULT_IMAGE_NAME;
    this.orchAgentsFile =
      options.orchAgentsFile || process.env.ORCH_AGENTS_FILE || DEFAULT_ORCH_AGENTS_FILE;
    this.hostDockerAgentsFile =
      options.hostDockerAgentsFile ||
      process.env.ORCH_HOST_DOCKER_AGENTS_FILE ||
      DEFAULT_HOST_DOCKER_AGENTS_FILE;
    this.getUid =
      options.getUid ||
      (() => (typeof process.getuid === 'function' ? process.getuid() : null));
    this.getGid =
      options.getGid ||
      (() => (typeof process.getgid === 'function' ? process.getgid() : null));
    this.running = new Map();
    this.accountStore =
      options.accountStore ||
      new AccountStore({
        orchHome: this.orchHome,
        codexHome: this.codexHome,
        now: this.now
      });
    this.maxAccountRotations = options.maxAccountRotations ?? this.parseRotationLimitEnv();
  }

  parseRotationLimitEnv() {
    const value = process.env.ORCH_ACCOUNT_ROTATION_MAX || DEFAULT_ACCOUNT_ROTATION_LIMIT;
    if (value === 'auto') return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  }

  gitCredentialHelper() {
    const helper =
      process.env.ORCH_GIT_CREDENTIAL_HELPER ||
      process.env.GIT_CONFIG_VALUE_1 ||
      DEFAULT_GIT_CREDENTIAL_HELPER;
    return helper || null;
  }

  withGitCredentialHelper(args = []) {
    const helper = this.gitCredentialHelper();
    if (!helper) return args;
    return ['-c', 'credential.helper=', '-c', `credential.helper=${helper}`, ...args];
  }

  dockerSocketPath() {
    if (process.env.DOCKER_SOCK) return process.env.DOCKER_SOCK;
    const dockerHost = process.env.DOCKER_HOST || '';
    if (dockerHost.startsWith('unix://')) {
      return dockerHost.slice('unix://'.length);
    }
    return '/var/run/docker.sock';
  }

  requireDockerSocket() {
    const socketPath = this.dockerSocketPath();
    if (!socketPath) {
      throw new Error('Docker socket path is not configured.');
    }
    if (!fs.existsSync(socketPath)) {
      throw new Error(`Docker socket not found at ${socketPath}.`);
    }
    return socketPath;
  }

  envsDir() {
    return path.join(this.orchHome, 'envs');
  }

  tasksDir() {
    return path.join(this.orchHome, 'tasks');
  }

  envDir(envId) {
    return path.join(this.envsDir(), envId);
  }

  uploadsDir() {
    return path.join(this.orchHome, 'uploads');
  }

  mirrorDir(envId) {
    return path.join(this.envDir(envId), 'mirror');
  }

  taskDir(taskId) {
    return path.join(this.tasksDir(), taskId);
  }

  taskWorktree(taskId, repoUrl) {
    const repoName = repoNameFromUrl(repoUrl);
    return path.join(this.taskDir(taskId), repoName);
  }

  taskContextDir(taskId) {
    return path.join(this.taskDir(taskId), 'context');
  }

  taskContextWorktree(taskId, repoUrl, envId) {
    const repoName = repoNameFromUrl(repoUrl);
    const suffix = envId ? `-${envId}` : '';
    return path.join(this.taskContextDir(taskId), `${repoName}${suffix}`);
  }

  taskArtifactsDir(taskId) {
    return path.join(this.taskDir(taskId), 'artifacts');
  }

  runArtifactsDir(taskId, runLabel) {
    return path.join(this.taskArtifactsDir(taskId), runLabel);
  }

  taskMetaPath(taskId) {
    return path.join(this.taskDir(taskId), 'meta.json');
  }

  taskLogsDir(taskId) {
    return path.join(this.taskDir(taskId), 'logs');
  }

  envRepoUrlPath(envId) {
    return path.join(this.envDir(envId), 'repo.url');
  }

  envDefaultBranchPath(envId) {
    return path.join(this.envDir(envId), 'default_branch');
  }

  async init() {
    await ensureDir(this.envsDir());
    await ensureDir(this.tasksDir());
  }

  async ensureActiveAuth() {
    try {
      await this.accountStore.applyActiveAccount();
    } catch (error) {
      // Best-effort: codex may still use existing auth.json.
    }
  }

  async getImageInfo() {
    const imageName = this.imageName;
    const result = await this.exec('docker', [
      'image',
      'inspect',
      '--format',
      '{{.Id}}|{{.Created}}',
      imageName
    ]);
    if (result.code !== 0) {
      return {
        imageName,
        present: false,
        imageId: null,
        imageCreatedAt: null
      };
    }
    const output = result.stdout.trim();
    const [imageId, imageCreatedAt] = output.split('|');
    return {
      imageName,
      present: true,
      imageId: imageId || null,
      imageCreatedAt: imageCreatedAt || null
    };
  }

  async pullImage() {
    await this.execOrThrow('docker', ['pull', this.imageName]);
    return this.getImageInfo();
  }

  async execOrThrow(command, args, options) {
    const result = await this.exec(command, args, options);
    if (result.code !== 0) {
      const message = result.stderr || result.stdout || `${command} failed`;
      throw new Error(message.trim());
    }
    return result;
  }

  async ensureOwnership(targetPath) {
    if (!(await pathExists(targetPath))) return;
    const uid = this.getUid();
    const gid = this.getGid();
    if (uid === null || gid === null) return;
    const ownership = `${uid}:${gid}`;
    if (uid === 0) {
      try {
        await this.exec('chown', ['-R', ownership, targetPath]);
      } catch (error) {
        // Best-effort: deletion can still proceed if chown fails.
      }
      return;
    }
    const containerTarget = '/target';
    try {
      await this.exec('docker', [
        'run',
        '--rm',
        '-v',
        `${targetPath}:${containerTarget}`,
        '--entrypoint',
        '/bin/sh',
        this.imageName,
        '-c',
        `chown -R ${ownership} ${containerTarget}`
      ]);
    } catch (error) {
      // Best-effort: deletion can still proceed if chown fails.
    }
  }

  async readEnv(envId) {
    const repoUrl = await readText(this.envRepoUrlPath(envId));
    const defaultBranch = await readText(this.envDefaultBranchPath(envId));
    return {
      envId,
      repoUrl,
      defaultBranch,
      mirrorPath: this.mirrorDir(envId)
    };
  }

  async listEnvs() {
    await this.init();
    const envIds = await listDirs(this.envsDir());
    const envs = [];
    for (const envId of envIds) {
      try {
        const env = await this.readEnv(envId);
        envs.push(env);
      } catch (error) {
        continue;
      }
    }
    return envs;
  }

  async createEnv({ repoUrl, defaultBranch }) {
    await this.init();
    const envId = crypto.randomUUID();
    const envDir = this.envDir(envId);
    const mirrorDir = this.mirrorDir(envId);
    await ensureDir(envDir);
    await writeText(this.envRepoUrlPath(envId), repoUrl);
    await writeText(this.envDefaultBranchPath(envId), defaultBranch);

    try {
      await this.execOrThrow('git', ['clone', '--bare', repoUrl, mirrorDir]);
      await this.execOrThrow('git', [
        '--git-dir',
        mirrorDir,
        'config',
        'remote.origin.fetch',
        '+refs/heads/*:refs/remotes/origin/*'
      ]);
      const refsToVerify = defaultBranch.startsWith('refs/')
        ? [defaultBranch]
        : [`refs/heads/${defaultBranch}`, `refs/remotes/origin/${defaultBranch}`];
      let verified = false;
      for (const ref of refsToVerify) {
        try {
          await this.execOrThrow('git', ['--git-dir', mirrorDir, 'show-ref', '--verify', ref]);
          verified = true;
          break;
        } catch (error) {
          // Try the next ref candidate.
        }
      }
      if (!verified) {
        throw new Error(`Default branch '${defaultBranch}' not found in repository.`);
      }
      return { envId, repoUrl, defaultBranch };
    } catch (error) {
      await removePath(envDir);
      throw error;
    }
  }

  async deleteEnv(envId) {
    await this.init();
    const tasks = await this.listTasks();
    for (const task of tasks.filter((item) => item.envId === envId)) {
      await this.deleteTask(task.taskId);
    }
    await this.ensureOwnership(this.envDir(envId));
    await removePath(this.envDir(envId));
  }

  async listTasks() {
    await this.init();
    const taskIds = await listDirs(this.tasksDir());
    const tasks = [];
    for (const taskId of taskIds) {
      const metaPath = this.taskMetaPath(taskId);
      if (!(await pathExists(metaPath))) continue;
      const meta = await readJson(metaPath);
      tasks.push(meta);
    }
    tasks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return tasks;
  }

  async getTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const [logTail, runLogs, gitStatus] = await Promise.all([
      this.readLogTail(taskId),
      this.readRunLogs(taskId),
      this.getTaskGitStatus(meta)
    ]);
    return { ...meta, logTail, runLogs, gitStatus };
  }

  async getTaskMeta(taskId) {
    return readJson(this.taskMetaPath(taskId));
  }

  async getTaskGitStatus(meta) {
    if (!meta?.worktreePath) return null;
    const status = {
      hasChanges: null,
      pushed: null,
      dirty: null
    };

    const dirtyResult = await this.exec('git', ['-C', meta.worktreePath, 'status', '--porcelain']);
    if (dirtyResult.code === 0) {
      status.dirty = dirtyResult.stdout.trim().length > 0;
    }

    if (meta.baseSha) {
      const diffResult = await this.exec('git', [
        '-C',
        meta.worktreePath,
        'diff',
        '--quiet',
        `${meta.baseSha}...HEAD`
      ]);
      if (diffResult.code === 0) status.hasChanges = false;
      if (diffResult.code === 1) status.hasChanges = true;
    }
    if (status.dirty === true && status.hasChanges !== true) {
      status.hasChanges = true;
    }

    let localHead = null;
    const headResult = await this.exec('git', ['-C', meta.worktreePath, 'rev-parse', 'HEAD']);
    if (headResult.code === 0) {
      localHead = headResult.stdout.trim() || null;
    }

    let remoteHead = null;
    let remoteQueryOk = false;
    const remoteResult = await this.exec('git', [
      '-C',
      meta.worktreePath,
      'ls-remote',
      '--heads',
      'origin',
      meta.branchName
    ]);
    if (remoteResult.code === 0) {
      remoteQueryOk = true;
      const line = remoteResult.stdout.split('\n').find(Boolean);
      if (line) {
        remoteHead = line.split(/\s+/)[0] || null;
      }
    }

    if (localHead && remoteQueryOk) {
      status.pushed = remoteHead ? remoteHead === localHead : false;
    }

    return status;
  }

  async getTaskDiff(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.baseSha) {
      return {
        available: false,
        reason: 'Base commit was not recorded for this task.'
      };
    }
    try {
      const result = await this.execOrThrow('git', [
        '-C',
        meta.worktreePath,
        'diff',
        '--no-color',
        `${meta.baseSha}...HEAD`
      ]);
      const files = parseUnifiedDiff(result.stdout);
      return {
        available: true,
        baseSha: meta.baseSha,
        files
      };
    } catch (error) {
      return {
        available: false,
        reason: error.message || 'Unable to generate diff.'
      };
    }
  }

  async readLogTail(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const latestRun = meta.runs[meta.runs.length - 1];
    if (!latestRun) return '';
    const logPath = path.join(this.taskLogsDir(taskId), latestRun.logFile);
    try {
      const content = await fsp.readFile(logPath, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      return lines.slice(-120).join('\n');
    } catch (error) {
      return '';
    }
  }

  async readRunLogs(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const runs = [];
    for (const run of meta.runs || []) {
      const logPath = path.join(this.taskLogsDir(taskId), run.logFile);
      let content = '';
      try {
        content = await fsp.readFile(logPath, 'utf8');
      } catch (error) {
        content = '';
      }
      runs.push({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || null,
        prompt: run.prompt,
        logFile: run.logFile,
        artifacts: run.artifacts || [],
        entries: parseLogEntries(content)
      });
    }
    return runs;
  }

  async finalizeRun(taskId, runLabel, result, prompt) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const threadId = result.threadId || parseThreadId(combinedOutput);
    const resolvedThreadId = threadId || meta.threadId || null;
    const stopped = result.stopped === true;
    const usageLimit = isUsageLimitError(combinedOutput);
    const success = !stopped && result.code === 0 && !!resolvedThreadId;
    const now = this.now();
    const artifactsDir = this.runArtifactsDir(taskId, runLabel);
    const artifacts = await listArtifacts(artifactsDir);

    meta.threadId = resolvedThreadId;
    meta.error = success
      ? null
      : stopped
        ? 'Stopped by user.'
        : usageLimit
          ? 'Usage limit reached.'
          : 'Unable to parse thread_id from codex output.';
    meta.status = success ? 'completed' : stopped ? 'stopped' : 'failed';
    meta.updatedAt = now;
    meta.lastPrompt = prompt || meta.lastPrompt || null;

    const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
    if (runIndex !== -1) {
      meta.runs[runIndex] = {
        ...meta.runs[runIndex],
        finishedAt: now,
        status: success ? 'completed' : stopped ? 'stopped' : 'failed',
        exitCode: result.code,
        artifacts
      };
    }

    await writeJson(this.taskMetaPath(taskId), meta);
  }

  buildAgentsAppendFile({ taskId, runLabel, useHostDockerSocket, contextRepos }) {
    const baseFile =
      this.orchAgentsFile && fs.existsSync(this.orchAgentsFile) ? this.orchAgentsFile : null;
    const hostDockerFile =
      this.hostDockerAgentsFile && fs.existsSync(this.hostDockerAgentsFile)
        ? this.hostDockerAgentsFile
        : null;
    const contextSection = buildContextReposSection(contextRepos);
    const shouldCombine = Boolean(useHostDockerSocket || contextSection);
    if (!shouldCombine) {
      return baseFile;
    }
    const sections = [];
    if (baseFile) {
      const baseContent = fs.readFileSync(baseFile, 'utf8').trimEnd();
      if (baseContent) {
        sections.push(baseContent);
      }
    }
    if (useHostDockerSocket && hostDockerFile) {
      const hostDockerContent = fs.readFileSync(hostDockerFile, 'utf8').trimEnd();
      if (hostDockerContent) {
        sections.push(hostDockerContent);
      }
    }
    if (contextSection) {
      sections.push(contextSection.trimEnd());
    }
    if (sections.length === 0) {
      return null;
    }
    const combined = `${sections.join('\n\n')}\n`;
    const targetPath = path.join(this.taskLogsDir(taskId), `${runLabel}.agents.md`);
    fs.writeFileSync(targetPath, combined, 'utf8');
    return targetPath;
  }

  startCodexRun({
    taskId,
    runLabel,
    prompt,
    cwd,
    args,
    mountPaths = [],
    mountPathsRo = [],
    contextRepos = [],
    useHostDockerSocket
  }) {
    const logFile = `${runLabel}.jsonl`;
    const logPath = path.join(this.taskLogsDir(taskId), logFile);
    const stderrPath = path.join(this.taskLogsDir(taskId), `${runLabel}.stderr`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
    const env = { ...process.env };
    const homeDir = env.HOME || os.homedir();
    const codexHome = this.codexHome || env.CODEX_HOME || path.join(homeDir, '.codex');
    env.HOME = homeDir;
    env.CODEX_HOME = codexHome;
    try {
      fs.mkdirSync(codexHome, { recursive: true });
    } catch (error) {
      // Best-effort: codex can still run if the directory is created elsewhere.
    }
    const agentsAppendFile = this.buildAgentsAppendFile({
      taskId,
      runLabel,
      useHostDockerSocket,
      contextRepos
    });
    if (agentsAppendFile) {
      env.CODEX_AGENTS_APPEND_FILE = agentsAppendFile;
    }
    const artifactsDir = this.runArtifactsDir(taskId, runLabel);
    env.CODEX_ARTIFACTS_DIR = artifactsDir;
    const existingMounts = env.CODEX_MOUNT_PATHS || '';
    const mountParts = existingMounts.split(':').filter(Boolean);
    for (const mountPath of mountPaths) {
      if (mountPath && fs.existsSync(mountPath) && !mountParts.includes(mountPath)) {
        mountParts.push(mountPath);
      }
    }
    if (fs.existsSync(codexHome) && !mountParts.includes(codexHome)) {
      mountParts.push(codexHome);
    }
    if (!mountParts.includes(artifactsDir)) {
      mountParts.push(artifactsDir);
    }
    env.CODEX_MOUNT_PATHS = mountParts.join(':');
    const existingMountsRo = env.CODEX_MOUNT_PATHS_RO || '';
    const mountPartsRo = existingMountsRo.split(':').filter(Boolean);
    for (const mountPath of mountPathsRo) {
      if (
        mountPath &&
        fs.existsSync(mountPath) &&
        !mountParts.includes(mountPath) &&
        !mountPartsRo.includes(mountPath)
      ) {
        mountPartsRo.push(mountPath);
      }
    }
    if (mountPartsRo.length > 0) {
      env.CODEX_MOUNT_PATHS_RO = mountPartsRo.join(':');
    } else {
      delete env.CODEX_MOUNT_PATHS_RO;
    }

    const child = this.spawn('codex-docker', args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (child.stdin) {
      if (typeof prompt === 'string' && prompt.length > 0) {
        child.stdin.write(prompt);
      }
      child.stdin.end();
    }

    const runState = { child, stopRequested: false, stopTimeout: null };
    this.running.set(taskId, runState);

    let stdoutBuffer = '';
    let stdoutFull = '';
    let stderrFull = '';
    let detectedThreadId = null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      logStream.write(text);
      stdoutFull += text;
      stdoutBuffer += text;
      let index = stdoutBuffer.indexOf('\n');
      while (index !== -1) {
        const line = stdoutBuffer.slice(0, index).trim();
        stdoutBuffer = stdoutBuffer.slice(index + 1);
        if (line) {
          const payload = safeJsonParse(line);
          if (payload && payload.type === 'thread.started' && payload.thread_id) {
            detectedThreadId = payload.thread_id;
          }
        }
        index = stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrStream.write(text);
      stderrFull += text;
    });

    const finalize = async (code, signal) => {
      logStream.end();
      stderrStream.end();
      if (runState.stopTimeout) {
        clearTimeout(runState.stopTimeout);
      }
      this.running.delete(taskId);
      const result = {
        stdout: stdoutFull,
        stderr: stderrFull,
        code: code ?? 1,
        stopped: runState.stopRequested || signal === 'SIGTERM' || signal === 'SIGKILL',
        threadId: detectedThreadId
      };
      await this.finalizeRun(taskId, runLabel, result, prompt);
      await this.maybeAutoRotate(taskId, prompt, result);
    };

    child.on('error', (error) => {
      stderrFull += error?.message ? `\n${error.message}` : '\nUnknown error';
      finalize(1, null).catch(() => {});
    });

    child.on('close', (code, signal) => {
      finalize(code, signal).catch(() => {});
    });
  }

  async resolveImagePaths(imagePaths) {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) return [];
    if (imagePaths.length > 5) {
      throw invalidImageError('Up to 5 images are supported per request.');
    }
    const uploadsRoot = path.resolve(this.uploadsDir());
    const resolved = [];
    for (const imagePath of imagePaths) {
      if (typeof imagePath !== 'string' || !imagePath.trim()) {
        throw invalidImageError('Invalid image path provided.');
      }
      const resolvedPath = path.resolve(imagePath);
      if (resolvedPath === uploadsRoot || !resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
        throw invalidImageError('Images must be uploaded via orchestrator before use.');
      }
      let stat;
      try {
        stat = await fsp.stat(resolvedPath);
      } catch (error) {
        throw invalidImageError(`Image not found: ${imagePath}`);
      }
      if (!stat.isFile()) {
        throw invalidImageError(`Image not found: ${imagePath}`);
      }
      if (!resolved.includes(resolvedPath)) {
        resolved.push(resolvedPath);
      }
    }
    return resolved;
  }

  async resolveContextRepos(taskId, contextRepos) {
    if (!Array.isArray(contextRepos) || contextRepos.length === 0) return [];
    await ensureDir(this.taskContextDir(taskId));
    const seenEnvIds = new Set();
    const resolved = [];
    for (const entry of contextRepos) {
      const envId = normalizeOptionalString(entry?.envId);
      if (!envId) {
        throw invalidContextError('Each context repo must include a valid envId.');
      }
      if (seenEnvIds.has(envId)) {
        continue;
      }
      seenEnvIds.add(envId);
      const ref = normalizeOptionalString(entry?.ref);
      const env = await this.readEnv(envId);
      await this.ensureOwnership(env.mirrorPath);
      await this.execOrThrow('git', [
        '--git-dir',
        env.mirrorPath,
        'fetch',
        'origin',
        '--prune',
        '+refs/heads/*:refs/remotes/origin/*'
      ]);
      const targetRef = ref || env.defaultBranch;
      const worktreeRef = await resolveRefInRepo(this.execOrThrow.bind(this), env.mirrorPath, targetRef);
      const baseShaResult = await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'rev-parse', worktreeRef]);
      const baseSha = baseShaResult.stdout.trim() || null;
      const worktreePath = this.taskContextWorktree(taskId, env.repoUrl, envId);
      await this.execOrThrow('git', [
        '--git-dir',
        env.mirrorPath,
        'worktree',
        'add',
        '--detach',
        worktreePath,
        worktreeRef
      ]);
      resolved.push({
        envId,
        repoUrl: env.repoUrl,
        ref: targetRef,
        baseSha,
        worktreePath
      });
    }
    return resolved;
  }

  async createTask({
    envId,
    ref,
    prompt,
    imagePaths,
    model,
    reasoningEffort,
    useHostDockerSocket,
    contextRepos
  }) {
    await this.init();
    const env = await this.readEnv(envId);
    await this.ensureOwnership(env.mirrorPath);
    const resolvedImagePaths = await this.resolveImagePaths(imagePaths);
    const normalizedModel = normalizeOptionalString(model);
    const normalizedReasoningEffort = normalizeOptionalString(reasoningEffort);
    const shouldUseHostDockerSocket = Boolean(useHostDockerSocket);
    const dockerSocketPath = shouldUseHostDockerSocket ? this.requireDockerSocket() : null;
    const taskId = crypto.randomUUID();
    const taskDir = this.taskDir(taskId);
    const logsDir = this.taskLogsDir(taskId);
    const worktreePath = this.taskWorktree(taskId, env.repoUrl);
    const branchName = `codex/${taskId}`;

    await ensureDir(taskDir);
    await ensureDir(logsDir);
    const resolvedContextRepos = await this.resolveContextRepos(taskId, contextRepos);

    const targetRef = ref || env.defaultBranch;

    await this.execOrThrow('git', [
      '--git-dir',
      env.mirrorPath,
      'fetch',
      'origin',
      '--prune',
      '+refs/heads/*:refs/remotes/origin/*'
    ]);
    const worktreeRef = await resolveRefInRepo(this.execOrThrow.bind(this), env.mirrorPath, targetRef);
    const baseShaResult = await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'rev-parse', worktreeRef]);
    const baseSha = baseShaResult.stdout.trim() || null;
    await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'worktree', 'add', worktreePath, worktreeRef]);
    await this.execOrThrow('git', ['-C', worktreePath, 'checkout', '-b', branchName]);

    const runLabel = nextRunLabel(1);
    await ensureDir(this.runArtifactsDir(taskId, runLabel));
    const logFile = `${runLabel}.jsonl`;
    const now = this.now();
    const activeAccount = await this.accountStore.getActiveAccount();
    const meta = {
      taskId,
      envId,
      repoUrl: env.repoUrl,
      ref: targetRef,
      baseSha,
      branchName,
      worktreePath,
      contextRepos: resolvedContextRepos,
      model: normalizedModel,
      reasoningEffort: normalizedReasoningEffort,
      useHostDockerSocket: shouldUseHostDockerSocket,
      threadId: null,
      error: null,
      status: 'running',
      initialPrompt: prompt,
      lastPrompt: prompt,
      createdAt: now,
      updatedAt: now,
      runs: [
        {
          runId: runLabel,
          prompt,
          model: normalizedModel,
          reasoningEffort: normalizedReasoningEffort,
          logFile,
          startedAt: now,
          finishedAt: null,
          status: 'running',
          exitCode: null,
          useHostDockerSocket: shouldUseHostDockerSocket,
          accountId: activeAccount?.id || null,
          accountLabel: activeAccount?.label || null
        }
      ]
    };

    await writeJson(this.taskMetaPath(taskId), meta);
    await this.ensureActiveAuth();
    const imageArgs = resolvedImagePaths.flatMap((imagePath) => ['--image', imagePath]);
    const args = buildCodexArgs({
      prompt,
      model: normalizedModel,
      reasoningEffort: normalizedReasoningEffort,
      imageArgs
    });
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: worktreePath,
      args,
      mountPaths: [
        env.mirrorPath,
        ...resolvedImagePaths,
        ...(dockerSocketPath ? [dockerSocketPath] : [])
      ],
      mountPathsRo: resolvedContextRepos.map((repo) => repo.worktreePath),
      contextRepos: resolvedContextRepos,
      useHostDockerSocket: shouldUseHostDockerSocket
    });
    return meta;
  }

  async resumeTask(taskId, prompt, options = {}) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.threadId) {
      throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
    }
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    const hasDockerSocketOverride = typeof options.useHostDockerSocket === 'boolean';
    const shouldUseHostDockerSocket = hasDockerSocketOverride
      ? options.useHostDockerSocket
      : Boolean(meta.useHostDockerSocket);
    const dockerSocketPath = shouldUseHostDockerSocket ? this.requireDockerSocket() : null;
    const env = await this.readEnv(meta.envId);
    await this.ensureOwnership(env.mirrorPath);
    const runsCount = meta.runs.length + 1;
    const runLabel = nextRunLabel(runsCount);
    const logFile = `${runLabel}.jsonl`;
    meta.updatedAt = this.now();
    meta.status = 'running';
    meta.lastPrompt = prompt;
    if (hasDockerSocketOverride) {
      meta.useHostDockerSocket = shouldUseHostDockerSocket;
    }
    const runModel =
      normalizeOptionalString(options.model) ?? normalizeOptionalString(meta.model);
    const runReasoningEffort =
      normalizeOptionalString(options.reasoningEffort) ??
      normalizeOptionalString(meta.reasoningEffort);
    const activeAccount = await this.accountStore.getActiveAccount();
    meta.runs.push({
      runId: runLabel,
      prompt,
      model: runModel,
      reasoningEffort: runReasoningEffort,
      logFile,
      startedAt: this.now(),
      finishedAt: null,
      status: 'running',
      exitCode: null,
      useHostDockerSocket: shouldUseHostDockerSocket,
      accountId: activeAccount?.id || null,
      accountLabel: activeAccount?.label || null
    });

    await ensureDir(this.runArtifactsDir(taskId, runLabel));
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.ensureActiveAuth();
    const args = buildCodexArgs({
      prompt,
      model: runModel,
      reasoningEffort: runReasoningEffort,
      resumeThreadId: meta.threadId
    });
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: meta.worktreePath,
      args,
      mountPaths: [
        env.mirrorPath,
        ...(dockerSocketPath ? [dockerSocketPath] : [])
      ],
      mountPathsRo: contextRepos.map((repo) => repo.worktreePath),
      contextRepos,
      useHostDockerSocket: shouldUseHostDockerSocket
    });
    return meta;
  }

  async stopTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const run = this.running.get(taskId);
    if (!run) {
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
    try {
      run.child.kill('SIGTERM');
      run.stopTimeout = setTimeout(() => {
        try {
          run.child.kill('SIGKILL');
        } catch (error) {
          // Ignore kill errors.
        }
      }, 5000);
    } catch (error) {
      // Ignore kill errors.
    }

    const updatedAt = this.now();
    meta.status = 'stopping';
    meta.updatedAt = updatedAt;
    if (meta.runs?.length) {
      meta.runs[meta.runs.length - 1] = {
        ...meta.runs[meta.runs.length - 1],
        status: 'stopping'
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    return meta;
  }

  async maybeAutoRotate(taskId, prompt, result) {
    if (!prompt) return;
    if (result.stopped) return;
    const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if (!isUsageLimitError(combinedOutput)) return;
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.threadId) return;
    const lastRun = meta.runs?.[meta.runs.length - 1];
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      return;
    }
    if (lastRun && !lastRun.accountId) {
      lastRun.accountId = activeAccount.id;
      lastRun.accountLabel = activeAccount.label || null;
      await writeJson(this.taskMetaPath(taskId), meta);
    }
    if (!lastRun?.accountId || lastRun.accountId !== activeAccount.id) {
      return;
    }
    const accountCount = await this.accountStore.countAccounts();
    if (accountCount < 2) return;
    const maxRotations =
      this.maxAccountRotations === null
        ? Math.max(0, accountCount - 1)
        : this.maxAccountRotations;
    const attempts = meta.autoRotateCount || 0;
    if (attempts >= maxRotations) return;
    await this.accountStore.rotateActiveAccount();
    meta.autoRotateCount = attempts + 1;
    meta.updatedAt = this.now();
    meta.status = 'running';
    meta.error = null;
    await writeJson(this.taskMetaPath(taskId), meta);
    await this.resumeTask(taskId, prompt, {
      model: meta.model,
      reasoningEffort: meta.reasoningEffort,
      useHostDockerSocket: meta.useHostDockerSocket
    });
  }

  async listAccounts() {
    return this.accountStore.listAccounts();
  }

  async addAccount({ label, authJson }) {
    const account = await this.accountStore.addAccount({ label, authJson });
    await this.accountStore.applyActiveAccount();
    return account;
  }

  async activateAccount(accountId) {
    await this.accountStore.setActiveAccount(accountId);
    return this.listAccounts();
  }

  async rotateAccount() {
    await this.accountStore.rotateActiveAccount();
    return this.listAccounts();
  }

  async removeAccount(accountId) {
    await this.accountStore.removeAccount(accountId);
    return this.listAccounts();
  }

  async getAccountRateLimits() {
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      throw noActiveAccountError('No active account. Add or activate an account first.');
    }
    await this.ensureActiveAuth();
    const rateLimits = await this.fetchAccountRateLimits();
    return {
      account: activeAccount,
      rateLimits,
      fetchedAt: this.now()
    };
  }

  async fetchAccountRateLimits() {
    const env = { ...process.env, CODEX_HOME: this.codexHome };
    const child = this.spawn('codex', ['app-server'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const initRequestId = 1;
    const rateLimitRequestId = 2;
    const initPayload = {
      method: 'initialize',
      id: initRequestId,
      params: {
        clientInfo: {
          name: 'codex-docker-orchestrator',
          title: 'Codex Docker Orchestrator',
          version: '0.1.0'
        }
      }
    };
    const rateLimitPayload = { method: 'account/rateLimits/read', id: rateLimitRequestId };

    return new Promise((resolve, reject) => {
      let resolved = false;
      let buffer = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        finalize(new Error('Timed out reading usage limits from Codex.'));
      }, 15000);

      const finalize = (error, value) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        try {
          child.kill('SIGTERM');
        } catch (killError) {
          // Ignore kill errors.
        }
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      };

      const send = (payload) => {
        try {
          child.stdin.write(`${JSON.stringify(payload)}\n`);
        } catch (error) {
          finalize(error);
        }
      };

      const handleMessage = (message) => {
        if (!message || typeof message !== 'object') return;
        if (message.id === initRequestId) {
          if (message.error) {
            const messageText = message.error.message || 'Failed to initialize Codex app-server.';
            finalize(new Error(messageText));
            return;
          }
          send({ method: 'initialized' });
          send(rateLimitPayload);
          return;
        }
        if (message.id === rateLimitRequestId) {
          if (message.error) {
            const messageText = message.error.message || 'Failed to read account rate limits.';
            finalize(new Error(messageText));
            return;
          }
          finalize(null, message.result?.rateLimits ?? null);
        }
      };

      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            try {
              const message = JSON.parse(line);
              handleMessage(message);
            } catch (error) {
              // Ignore parse errors from non-JSON output.
            }
          }
          newlineIndex = buffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => finalize(error));

      child.on('close', () => {
        if (resolved) return;
        const message = stderr.trim() || 'Codex app-server exited before responding.';
        finalize(new Error(message));
      });

      send(initPayload);
    });
  }

  async deleteTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const env = await this.readEnv(meta.envId);
    const worktreePath = meta.worktreePath;
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    await this.ensureOwnership(worktreePath);
    await this.ensureOwnership(this.taskDir(taskId));
    for (const contextRepo of contextRepos) {
      const contextPath = contextRepo?.worktreePath;
      if (!contextPath) continue;
      await this.ensureOwnership(contextPath);
      let contextEnv = null;
      try {
        contextEnv = await this.readEnv(contextRepo.envId);
      } catch (error) {
        contextEnv = null;
      }
      if (contextEnv?.mirrorPath) {
        const contextResult = await this.exec('git', [
          '--git-dir',
          contextEnv.mirrorPath,
          'worktree',
          'remove',
          '--force',
          contextPath
        ]);
        if (contextResult.code !== 0) {
          const message = (contextResult.stderr || contextResult.stdout || '').trim();
          const ignorable =
            message.includes('not a working tree') ||
            message.includes('does not exist') ||
            message.includes('No such file or directory');
          if (!ignorable) {
            throw new Error(message || 'Failed to remove context worktree');
          }
        }
      }
      if (await pathExists(contextPath)) {
        await removePath(contextPath);
      }
      if (contextEnv?.mirrorPath) {
        await this.exec('git', ['--git-dir', contextEnv.mirrorPath, 'worktree', 'prune', '--expire', 'now']);
      }
    }
    const result = await this.exec('git', [
      '--git-dir',
      env.mirrorPath,
      'worktree',
      'remove',
      '--force',
      worktreePath
    ]);
    if (result.code !== 0) {
      const message = (result.stderr || result.stdout || '').trim();
      const ignorable =
        message.includes('not a working tree') ||
        message.includes('does not exist') ||
        message.includes('No such file or directory');
      if (!ignorable) {
        throw new Error(message || 'Failed to remove worktree');
      }
    }
    if (await pathExists(worktreePath)) {
      await removePath(worktreePath);
    }
    await this.exec('git', ['--git-dir', env.mirrorPath, 'worktree', 'prune', '--expire', 'now']);
    await removePath(this.taskDir(taskId));
  }

  async pushTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    await this.execOrThrow('git', [
      '-C',
      meta.worktreePath,
      '-c',
      'remote.origin.mirror=false',
      'push',
      'origin',
      meta.branchName
    ]);

    const githubToken = process.env.ORCH_GITHUB_TOKEN;
    const githubRepo = process.env.ORCH_GITHUB_REPO;
    if (!githubToken || !githubRepo) {
      return { pushed: true, prCreated: false };
    }

    const env = await this.readEnv(meta.envId);
    const response = await this.fetch(`https://api.github.com/repos/${githubRepo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        title: `Codex task ${meta.taskId}`,
        head: meta.branchName,
        base: env.defaultBranch,
        body: `Automated PR for task ${meta.taskId}.`
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to create PR');
    }

    const data = await response.json();
    return { pushed: true, prCreated: true, prUrl: data.html_url };
  }
}

module.exports = {
  Orchestrator,
  parseThreadId,
  isUsageLimitError
};
