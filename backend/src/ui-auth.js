const crypto = require('node:crypto');
const path = require('node:path');
const { readJson, writeJson, pathExists } = require('./storage');

const AUTH_FILE = 'ui-auth.json';
const HASH_ALGO = 'sha256';
const HASH_ITERATIONS = 120000;
const HASH_LENGTH = 32;

function authFilePath(orchestrator) {
  return path.join(orchestrator.orchHome, AUTH_FILE);
}

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_LENGTH, HASH_ALGO)
    .toString('hex');
}

async function loadAuth(orchestrator) {
  const filePath = authFilePath(orchestrator);
  if (!(await pathExists(filePath))) {
    return null;
  }
  const payload = await readJson(filePath);
  if (!payload || !payload.salt || !payload.hash) {
    return null;
  }
  return payload;
}

async function hasPassword(orchestrator) {
  const auth = await loadAuth(orchestrator);
  return Boolean(auth);
}

async function verifyPassword(orchestrator, password) {
  if (!password) {
    return false;
  }
  const auth = await loadAuth(orchestrator);
  if (!auth) {
    return true;
  }
  const hashed = hashPassword(password, auth.salt);
  return crypto.timingSafeEqual(Buffer.from(hashed, 'hex'), Buffer.from(auth.hash, 'hex'));
}

async function setPassword(orchestrator, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const payload = {
    salt,
    hash,
    createdAt: new Date().toISOString()
  };
  await writeJson(authFilePath(orchestrator), payload);
}

module.exports = {
  hasPassword,
  verifyPassword,
  setPassword
};
