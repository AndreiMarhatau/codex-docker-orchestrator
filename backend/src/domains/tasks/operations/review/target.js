function normalizeReviewTarget(input = {}) {
  const type = input.type || input.targetType || 'uncommittedChanges';
  if (type === 'uncommittedChanges') {
    return { type };
  }
  if (type === 'baseBranch') {
    const branch = String(input.branch || '').trim();
    if (!branch) {
      throw new Error('baseBranch review requires a branch.');
    }
    return { type, branch };
  }
  if (type === 'commit') {
    const sha = String(input.sha || input.commitSha || '').trim();
    if (!sha) {
      throw new Error('commit review requires a commit sha.');
    }
    const title = String(input.title || input.commitTitle || '').trim();
    return { type, sha, title: title || null };
  }
  if (type === 'custom') {
    const instructions = String(input.instructions || '').trim();
    if (!instructions) {
      throw new Error('custom review requires instructions.');
    }
    return { type, instructions };
  }
  throw new Error('Unknown review target.');
}

function reviewTargetLabel(target) {
  if (target.type === 'uncommittedChanges') {
    return 'uncommitted changes';
  }
  if (target.type === 'baseBranch') {
    return `changes against ${target.branch}`;
  }
  if (target.type === 'commit') {
    return `commit ${target.sha}`;
  }
  return 'custom review';
}

module.exports = {
  normalizeReviewTarget,
  reviewTargetLabel
};
