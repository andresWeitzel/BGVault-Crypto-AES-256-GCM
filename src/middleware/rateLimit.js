const { CODES, sendError } = require('../http/respond');

const buckets = new Map();
const MAX_KEYS = 10000;

function envInt(name, fallback) {
  const parsed = Number(process.env[name]);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function clientIp(req) {
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function prune(now) {
  if (buckets.size < MAX_KEYS) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.start >= bucket.windowMs) buckets.delete(key);
    }
    return;
  }
  for (const [key, bucket] of buckets) {
    if (now - bucket.start >= bucket.windowMs) buckets.delete(key);
  }
  if (buckets.size >= MAX_KEYS) {
    const first = buckets.keys().next().value;
    if (first) buckets.delete(first);
  }
}

function createRateLimit({ max, windowMs, keyFn }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);
    const key = keyFn(req);
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0, windowMs };
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, max - bucket.count);
    const resetEpoch = Math.ceil((bucket.start + windowMs) / 1000);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetEpoch));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return sendError(res, 429, CODES.RATE_LIMITED, 'Demasiadas solicitudes');
    }
    return next();
  };
}

const limitAuth = createRateLimit({
  max: envInt('RATE_LIMIT_AUTH_MAX', 60),
  windowMs: envInt('RATE_LIMIT_AUTH_WINDOW_MS', 10 * 60 * 1000),
  keyFn: (req) => `auth:${clientIp(req)}`,
});

const limitReveal = createRateLimit({
  max: envInt('RATE_LIMIT_REVEAL_MAX', 120),
  windowMs: envInt('RATE_LIMIT_REVEAL_WINDOW_MS', 60 * 1000),
  keyFn: (req) => `reveal:${req.user?.id || clientIp(req)}`,
});

module.exports = {
  createRateLimit,
  limitAuth,
  limitReveal,
  clientIp,
};
