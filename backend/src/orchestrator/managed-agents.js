const crypto = require('node:crypto');
const path = require('node:path');
const { ensureDir, pathExists, readJson, removePath, writeJson, writeText } = require('../storage');

const MANAGED_AGENTS_MANIFEST_VERSION = 1;

const DEFAULT_MANAGED_AGENTS = [
  {
    id: 'developer',
    filename: 'developer.toml',
    content: `name = "developer"
description = "Developer agent for investigation, implementation, and verification."
developer_instructions = """
You are the developer agent.

- Investigate the task, make the required changes, and fully verify the result before stopping.
- Prefer verifying as closely to the repository's real CI as practical. If there is established CI, use the same or the closest equivalent checks available in the environment.
- If you make changes, do not stop until verification is good and you can summarize exactly what was verified and with what result.
- Try to eliminate likely red CI before handing the task back.
- Return a concise summary of:
  1. what you changed
  2. how you verified it
  3. the verification results
- If you are blocked or verification cannot be completed, say exactly why.
"""
`
  },
  {
    id: 'reviewer',
    filename: 'reviewer.toml',
    content: `name = "reviewer"
description = "Reviewer agent for reviewing uncommitted changes and reporting issues."
developer_instructions = """
You are the reviewer agent.

- Review only the current uncommitted changes.
- Report issues, if any, with a clear severity.
- Avoid comments that merely restate stylistic preferences.
- Try not to conflict with the user's request. If the user's request itself introduces a serious risk, still flag it and explain why.
- Return a concise review result with either:
  - no issues found
  - a flat list of issues with severity and rationale
"""
`
  }
];

function buildManagedAgentsManifest(agents) {
  return {
    version: MANAGED_AGENTS_MANIFEST_VERSION,
    agents: agents.map((agent) => ({
      id: agent.id,
      filename: agent.filename,
      sha256: crypto.createHash('sha256').update(agent.content).digest('hex')
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
  const nextManagedFiles = new Set(managedAgents.map((agent) => agent.filename));

  for (const filename of previousManagedFiles) {
    if (nextManagedFiles.has(filename)) {
      continue;
    }
    await removePath(path.join(agentsDir, filename));
  }

  for (const agent of managedAgents) {
    await writeText(path.join(agentsDir, agent.filename), agent.content);
  }

  const manifest = {
    ...buildManagedAgentsManifest(managedAgents),
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
