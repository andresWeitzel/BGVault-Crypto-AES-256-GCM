const crypto = require('node:crypto');

function readProvidedKey(req) {
  const fromHeader = req.get('x-api-key');
  if (fromHeader) return fromHeader.trim();

  const authorization = req.get('authorization');
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    if (left.length > 0) crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY || '';
  const provided = readProvidedKey(req);

  if (!provided || !expected || !safeEqual(provided, expected)) {
    return res.status(401).json({
      error: 'No autorizado',
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}

module.exports = requireApiKey;
