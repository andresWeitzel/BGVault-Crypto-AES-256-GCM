const CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  VALIDATION: 'VALIDATION',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INTERNAL: 'INTERNAL',
  JSON_INVALID: 'JSON_INVALID',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  CREDENTIAL_NOT_FOUND: 'CREDENTIAL_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  CREDENTIAL_EXPIRED: 'CREDENTIAL_EXPIRED',
  REVEAL_LIMIT: 'REVEAL_LIMIT',
  RATE_LIMITED: 'RATE_LIMITED',
};

function sendOk(res, status, body = {}) {
  return res.status(status).json({
    ...body,
    requestId: res.locals.requestId,
    timestamp: body.timestamp || new Date().toISOString(),
  });
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
    requestId: res.locals.requestId || null,
    timestamp: new Date().toISOString(),
  });
}

function sendValidation(res, message) {
  return sendError(res, 400, CODES.VALIDATION, message);
}

function sendInternal(res, logMessage, error) {
  const requestId = res.locals.requestId || '-';
  console.error(`[${requestId}] ${logMessage}:`, error && error.message ? error.message : error);
  return sendError(res, 500, CODES.INTERNAL, 'Error interno');
}

module.exports = {
  CODES,
  sendOk,
  sendError,
  sendValidation,
  sendInternal,
};
