const crypto = require('node:crypto');
const path = require('node:path');
const { ensureDir, pathExists, readJson, removePath, writeJson, writeText } = require('../storage');
const {
  DEVELOPER_AGENT_INSTRUCTIONS,
  ARCHITECT_AGENT_INSTRUCTIONS,
  REVIEWER_AGENT_INSTRUCTIONS
} = require('./agent-instructions');
const { readUserInstructions } = require('./user-instructions');

const MANAGED_AGENTS_MANIFEST_VERSION = 1;

const DEFAULT_MANAGED_AGENTS = [
  {
    id: 'developer',
    filename: 'developer.toml',
    name: 'developer',
    description: 'Developer agent for investigation, implementation, and verification.',
    developerInstructions: DEVELOPER_AGENT_INSTRUCTIONS
  },
  {
    id: 'architect',
    filename: 'architect.toml',
    name: 'architect',
    description: 'Architect agent for architecture-focused review when complexity or domain risk warrants it.',
    developerInstructions: ARCHITECT_AGENT_INSTRUCTIONS
  },
  {
    id: 'reviewer',
    filename: 'reviewer.toml',
    name: 'reviewer',
    description: 'Reviewer agent for reviewing uncommitted changes and reporting issues.',
    developerInstructions: REVIEWER_AGENT_INSTRUCTIONS
  }
];

function buildManagedAgentContent(agent, userInstructions) {
  if (typeof agent?.content === 'string' && !agent?.developerInstructions) {
    return agent.content;
  }

  let instructions = agent?.developerInstructions || '';
  if (userInstructions && agent?.id === 'developer') {
    instructions = [
      userInstructions,
      '',
      '--- managed-developer-instructions ---',
      '',
      instructions
    ].join('\n');
  }

  return [
    `name = ${JSON.stringify(agent?.name || '')}`,
    `description = ${JSON.stringify(agent?.description || '')}`,
    `developer_instructions = ${JSON.stringify(instructions)}`,
    ''
  ].join('\n');
}

function resolveManagedAgents(managedAgents, userInstructions) {
  return managedAgents.map((agent) => ({
    ...agent,
    content: buildManagedAgentContent(agent, userInstructions)
  }));
}

function buildManagedAgentsManifest(agents) {
  return {
    version: MANAGED_AGENTS_MANIFEST_VERSION,
    agents: agents.map((agent) => ({
      id: agent.id,
      filename: agent.filename,
      sha256: crypto.createHash('sha256').update(
        typeof agent?.content === 'string' ? agent.content : buildManagedAgentContent(agent, '')
      ).digest('hex')
    }))
  };
}

async function reconcileManagedAgents({
  codexHome,
  now,
  managedAgents = DEFAULT_MANAGED_AGENTS
}) {
  const agentsDir = path.join(codexHome, 'agents');
  const metadataDir = path.join(codexHome, '.codex-docker-orchestrator');
  const manifestPath = path.join(metadataDir, 'managed-agents-manifest.json');
  await ensureDir(agentsDir);
  await ensureDir(metadataDir);

  let existingManifest = null;
  if (await pathExists(manifestPath)) {
    try {
      existingManifest = await readJson(manifestPath);
    } catch {
      existingManifest = null;
    }
  }

  const previousManagedFiles = new Set(
    Array.isArray(existingManifest?.agents)
      ? existingManifest.agents
        .map((agent) => (typeof agent?.filename === 'string' ? agent.filename.trim() : ''))
        .filter(Boolean)
      : []
  );
  const userInstructions = readUserInstructions(codexHome);
  const resolvedManagedAgents = resolveManagedAgents(managedAgents, userInstructions);
  const nextManagedFiles = new Set(resolvedManagedAgents.map((agent) => agent.filename));

  for (const filename of previousManagedFiles) {
    if (nextManagedFiles.has(filename)) {
      continue;
    }
    await removePath(path.join(agentsDir, filename));
  }

  for (const agent of resolvedManagedAgents) {
    await writeText(path.join(agentsDir, agent.filename), agent.content);
  }

  const manifest = {
    ...buildManagedAgentsManifest(resolvedManagedAgents),
    updatedAt: now()
  };
  await writeJson(manifestPath, manifest);
  return manifest;
}

module.exports = {
  DEFAULT_MANAGED_AGENTS,
  MANAGED_AGENTS_MANIFEST_VERSION,
  buildManagedAgentsManifest,
  reconcileManagedAgents
};
