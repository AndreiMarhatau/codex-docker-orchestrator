const { attachGenerateCommitMessageMethod } = require('./commit-message');
const { attachCommitAndPushTaskMethod, attachPushTaskMethod } = require('./push');
const {
  attachStartCommitAndPushTaskMethod,
  attachStartPushTaskMethod
} = require('./start');

function attachTaskPublicationMethods(Orchestrator) {
  attachPushTaskMethod(Orchestrator);
  attachGenerateCommitMessageMethod(Orchestrator);
  attachCommitAndPushTaskMethod(Orchestrator);
  attachStartPushTaskMethod(Orchestrator);
  attachStartCommitAndPushTaskMethod(Orchestrator);
}

module.exports = {
  attachTaskPublicationMethods
};
