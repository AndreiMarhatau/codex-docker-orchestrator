const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCodexArgs } = require('./context');

const USAGE_TRIGGER_PROMPT = 'Do not do any work. Reply with exactly "Hi" and nothing else.';

function buildUsageTriggerArgs() {
  const args = buildCodexArgs({ prompt: USAGE_TRIGGER_PROMPT });
  if (args[0] === 'exec') {
    args.splice(1, 0, '--skip-git-repo-check');
  }
  return args;
}

function waitForTriggerExit(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (error) {
        // Ignore kill errors on timeout cleanup.
      }
      finalize(new Error('Timed out triggering Codex usage.'));
    }, 120000);

    const finalize = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => finalize(error));
    child.on('close', (code) => {
      if (code === 0) {
        finalize(null);
        return;
      }
      const message = stderr.trim() || stdout.trim() || `codex-docker exited with code ${code}.`;
      finalize(new Error(message));
    });
  });
}

async function runAccountUsageTrigger({ spawn, env }) {
  const triggerCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-usage-trigger-'));
  try {
    const child = spawn('codex-docker', buildUsageTriggerArgs(), {
      cwd: triggerCwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (child.stdin) {
      child.stdin.end();
    }
    await waitForTriggerExit(child);
  } finally {
    try {
      fs.rmSync(triggerCwd, { recursive: true, force: true });
    } catch (error) {
      // Best-effort cleanup of trigger workspace.
    }
  }
}

module.exports = {
  USAGE_TRIGGER_PROMPT,
  runAccountUsageTrigger
};
