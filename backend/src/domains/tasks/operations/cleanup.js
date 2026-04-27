const { attachDeleteTaskMethod, cleanupContextRepos } = require('./deletion/methods');
const { attachTaskPublicationMethods } = require('./publication/methods');

function attachTaskCleanupMethods(Orchestrator) {
  attachDeleteTaskMethod(Orchestrator);
  attachTaskPublicationMethods(Orchestrator);
}

module.exports = {
  attachTaskCleanupMethods,
  cleanupContextRepos
};
