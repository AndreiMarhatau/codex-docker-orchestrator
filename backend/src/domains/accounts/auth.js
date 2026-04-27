const DEFAULT_LABEL_PREFIX = 'Account';

function normalizeLabel(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function parseAuthJson(authJson) {
  if (typeof authJson !== 'string') {
    throw new Error('authJson must be a string');
  }
  const trimmed = authJson.trim();
  if (!trimmed) {
    throw new Error('authJson is required');
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error('authJson must be valid JSON');
  }
}

module.exports = {
  DEFAULT_LABEL_PREFIX,
  normalizeLabel,
  parseAuthJson
};
