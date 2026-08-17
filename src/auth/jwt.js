const crypto = require('node:crypto');

const DEFAULT_EXPIRES_IN = 8 * 60 * 60;

function getSecret() {
  return process.env.JWT_SECRET || '';
}

function getExpiresIn() {
  const parsed = Number(process.env.JWT_EXPIRES_IN);
  if (Number.isInteger(parsed) && parsed >= 60 && parsed <= 60 * 60 * 24 * 7) {
    return parsed;
  }
  return DEFAULT_EXPIRES_IN;
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

function sign(payload) {
  const secret = getSecret();
  const expiresIn = getExpiresIn();
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat, exp: iat + expiresIn };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return { token: `${headerB64}.${payloadB64}.${signature}`, expiresIn };
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  let header;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.sub || typeof payload.sub !== 'string') return null;
  if (!Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

module.exports = {
  sign,
  verify,
  getExpiresIn,
  DEFAULT_EXPIRES_IN,
};
