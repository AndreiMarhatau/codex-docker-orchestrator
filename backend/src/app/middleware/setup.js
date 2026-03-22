const { asyncHandler } = require('./async-handler');

function createSetupMiddleware(orchestrator) {
  return asyncHandler(async (_req, _res, next) => {
    await orchestrator.assertSetupReady();
    next();
  });
}

module.exports = {
  createSetupMiddleware
};
