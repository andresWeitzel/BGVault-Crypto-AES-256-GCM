const { CODES, sendError } = require('../http/respond');

const buckets = new Map();
const MAX_KEYS = 10000;

function envInt(name, fallback) {
  const parsed = Number(process.env[name]);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function firstForwarded(value) {
  if (typeof value !== 'string') return '';
  const ip = value.split(',')[0].trim();
  return ip || '';
}

function clientIp(req) {
  const realIp = firstForwarded(req.headers['x-real-ip']);
  if (realIp) return realIp;
  const forwarded = firstForwarded(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded;
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress || 'unknown';
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

function createRateLimit({ max, windowMs, keyFn, message = 'Demasiadas solicitudes' }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);
    const key = keyFn(req);
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= bucket.windowMs) {
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
      return sendError(res, 429, CODES.RATE_LIMITED, message);
    }
    return next();
  };
}

function skip(_req, _res, next) {
  return next();
}

function createIpRateLimit() {
  const max = Number(process.env.RATE_LIMIT_IP_MAX);
  if (!Number.isInteger(max) || max < 1) return skip;
  return createRateLimit({
    max,
    windowMs: envInt('RATE_LIMIT_IP_WINDOW_MS', 10 * 60 * 1000),
    keyFn: (req) => `ip:${clientIp(req)}`,
    message: 'Demasiadas solicitudes para esta IP',
  });
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
  createIpRateLimit,
  limitAuth,
  limitReveal,
  clientIp,
};
