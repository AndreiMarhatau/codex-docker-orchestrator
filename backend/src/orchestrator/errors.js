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

function invalidAttachmentError(message) {
  return createError('INVALID_ATTACHMENT', message);
}

function noActiveAccountError(message) {
  return createError('NO_ACTIVE_ACCOUNT', message);
}

module.exports = {
  invalidAttachmentError,
  invalidImageError,
  invalidContextError,
  noActiveAccountError
};
