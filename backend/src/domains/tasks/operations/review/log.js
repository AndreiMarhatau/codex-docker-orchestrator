const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function appendRunItem(orchestrator, taskId, runLabel, item) {
  const logPath = path.join(orchestrator.taskLogsDir(taskId), `${runLabel}.jsonl`);
  const payload = {
    type: 'item.completed',
    item
  };
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`);
}

async function appendRunAgentMessage(orchestrator, taskId, runLabel, text) {
  await appendRunItem(orchestrator, taskId, runLabel, {
    id: `message-${crypto.randomUUID()}`,
    type: 'agent_message',
    text
  });
}

async function appendRunReviewMessage(orchestrator, taskId, runLabel, options) {
  await appendRunItem(orchestrator, taskId, runLabel, {
    id: `review-${crypto.randomUUID()}`,
    type: 'review',
    phase: options.phase,
    target: options.target,
    automatic: options.automatic === true,
    text: options.text
  });
}

module.exports = {
  appendRunAgentMessage,
  appendRunReviewMessage
};
