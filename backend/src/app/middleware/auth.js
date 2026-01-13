const { hasPassword, verifyPassword } = require('../../ui-auth');

function extractPassword(req) {
  if (req.headers && req.headers['x-orch-password']) {
    return String(req.headers['x-orch-password']);
  }
  if (req.query && req.query.password) {
    return String(req.query.password);
  }
  return '';
}

function createAuthMiddleware(orchestrator) {
  return async (req, res, next) => {
    const passwordSet = await hasPassword(orchestrator);
    if (!passwordSet) {
      return next();
    }

    if (
      req.path === '/health' ||
      req.path === '/settings/password' ||
      req.path === '/settings/auth'
    ) {
      return next();
    }

    const provided = extractPassword(req);
    const ok = await verifyPassword(orchestrator, provided);
    if (!ok) {
      return res.status(401).send('Password required');
    }
    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  extractPassword
};
