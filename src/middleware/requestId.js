const crypto = require('node:crypto');

const INCOMING_RE = /^[\w.:-]{8,128}$/;

function requestId(req, res, next) {
  const incoming = (req.get('x-request-id') || '').trim();
  const id = INCOMING_RE.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  return next();
}

module.exports = requestId;
