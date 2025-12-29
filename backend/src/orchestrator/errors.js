function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function invalidImageError(message) {
  return createError('INVALID_IMAGE', message);
}

function invalidContextError(message) {
  return createError('INVALID_CONTEXT', message);
}

function noActiveAccountError(message) {
  return createError('NO_ACTIVE_ACCOUNT', message);
}

module.exports = {
  invalidImageError,
  invalidContextError,
  noActiveAccountError
};
