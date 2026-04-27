const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AppServerClient } = require('../../shared/codex/app-server-client');
const { buildCodexAppServerArgs } = require('../../shared/codex/app-server-args');

const USAGE_TRIGGER_PROMPT = 'Do not do any work. Reply with exactly "Hi" and nothing else.';

function waitForTriggerTurn(client) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
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

    client.on('notification', (message) => {
      if (message.method !== 'turn/completed') {
        return;
      }
      if ((message.params?.turn?.status || 'completed') === 'completed') {
        finalize(null);
        return;
      }
      finalize(new Error(message.params?.turn?.error?.message || 'Codex usage trigger failed.'));
    });
    client.on('close', () => finalize(new Error('Codex app-server exited before responding.')));
  });
}

async function runAccountUsageTrigger({ spawn, env }) {
  const triggerCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-usage-trigger-'));
  let child = null;
  try {
    child = spawn('codex-docker', buildCodexAppServerArgs(), {
      cwd: triggerCwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const client = new AppServerClient({ child });
    await client.initialize();
    const threadResponse = await client.request('thread/start', {
      cwd: triggerCwd,
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
      ephemeral: true
    });
    const completion = waitForTriggerTurn(client);
    await client.request('turn/start', {
      threadId: threadResponse.thread?.id,
      input: [{ type: 'text', text: USAGE_TRIGGER_PROMPT }],
      cwd: triggerCwd,
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'dangerFullAccess' }
    });
    await completion;
  } finally {
    if (child) {
      try {
        child.kill('SIGTERM');
      } catch (error) {
        // Ignore kill errors on shutdown cleanup.
      }
    }
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
