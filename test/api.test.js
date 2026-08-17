process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'test-encryption-key-must-be-32chars';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-must-be-32chars!!';
process.env.SQLITE_PATH = ':memory:';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_REVEAL_MAX = '1000';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadAndValidate } = require('../src/config/env');
const sqlite = require('../src/db/sqlite');
const jwt = require('../src/auth/jwt');
const { createApp } = require('../src/app');

let server;
let base;

function decodePayload(token) {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const json = await res.json();
  return { status: res.status, json, headers: res.headers };
}

async function register(email) {
  const password = 'bgvault-dev-password';
  const created = await req('POST', '/api/auth/register', {
    body: { email, password },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  return { token: created.json.accessToken, email, password, user: created.json.user };
}

before(async () => {
  loadAndValidate();
  sqlite.open();
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  sqlite.close();
});

test('health incluye requestId y auth jwt', async () => {
  const { status, json, headers } = await req('GET', '/health');
  assert.equal(status, 200);
  assert.equal(json.status, 'OK');
  assert.equal(json.auth, 'jwt');
  assert.equal(typeof json.requestId, 'string');
  assert.equal(headers.get('x-request-id'), json.requestId);
});

test('sin Bearer responde UNAUTHORIZED', async () => {
  const { status, json } = await req('GET', '/api/credentials');
  assert.equal(status, 401);
  assert.equal(json.error.code, 'UNAUTHORIZED');
});

test('JWT lleva jti y logout lo revoca', async () => {
  const session = await register(`logout-${Date.now()}@bgvault.local`);
  const payload = decodePayload(session.token);
  assert.equal(typeof payload.jti, 'string');
  assert.equal(payload.jti.length > 0, true);

  const me = await req('GET', '/api/auth/me', { token: session.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, session.email);

  const closed = await req('POST', '/api/auth/logout', { token: session.token, body: {} });
  assert.equal(closed.status, 200);
  assert.equal(closed.json.message, 'Sesión cerrada');

  const afterLogout = await req('GET', '/api/auth/me', { token: session.token });
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.json.error.code, 'TOKEN_REVOKED');

  const again = await req('POST', '/api/auth/logout', { token: session.token, body: {} });
  assert.equal(again.status, 401);
  assert.equal(again.json.error.code, 'TOKEN_REVOKED');

  const login = await req('POST', '/api/auth/login', {
    body: { email: session.email, password: session.password },
  });
  assert.equal(login.status, 200);
  assert.notEqual(login.json.accessToken, session.token);
  const me2 = await req('GET', '/api/auth/me', { token: login.json.accessToken });
  assert.equal(me2.status, 200);
});

test('login inválido es INVALID_CREDENTIALS', async () => {
  const { status, json } = await req('POST', '/api/auth/login', {
    body: { email: 'nobody@bgvault.local', password: 'wrong-password' },
  });
  assert.equal(status, 401);
  assert.equal(json.error.code, 'INVALID_CREDENTIALS');
});

test('JWT sin jti no autoriza', () => {
  const secret = process.env.JWT_SECRET;
  const iat = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ sub: 'anyone', email: 'x@y.z', iat, exp: iat + 3600 }),
  ).toString('base64url');
  const crypto = require('node:crypto');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  assert.equal(jwt.verify(`${header}.${body}.${signature}`), null);
});

test('credencial ajena responde 404', async () => {
  const owner = await register(`owner-${Date.now()}@bgvault.local`);
  const created = await req('POST', '/api/credentials', {
    token: owner.token,
    body: { type: 'note', name: 'Privada', payload: { text: 'secreto' } },
  });
  assert.equal(created.status, 201);
  const id = created.json.credential.id;

  const other = await register(`other-${Date.now()}@bgvault.local`);
  const get = await req('GET', `/api/credentials/${id}`, { token: other.token });
  assert.equal(get.status, 404);
  assert.equal(get.json.error.code, 'CREDENTIAL_NOT_FOUND');
});

test('PATCH cambia metadatos sin subir versión ni payload', async () => {
  const session = await register(`patch-${Date.now()}@bgvault.local`);
  const created = await req('POST', '/api/credentials', {
    token: session.token,
    body: {
      type: 'password',
      name: 'Original',
      payload: { password: 'clave-original', username: 'u' },
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.credential.id;

  const patched = await req('PATCH', `/api/credentials/${id}`, {
    token: session.token,
    body: { name: 'Renombrada', tags: ['a'] },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.credential.name, 'Renombrada');
  assert.equal(patched.json.credential.currentVersion, 1);
  assert.equal(patched.json.credential.payload, undefined);

  const revealed = await req('POST', `/api/credentials/${id}/reveal`, {
    token: session.token,
    body: {},
  });
  assert.equal(revealed.status, 200);
  assert.equal(revealed.json.payload.password, 'clave-original');
  assert.equal(revealed.json.credential.name, 'Renombrada');
});

test('list pagina con limit y offset', async () => {
  const session = await register(`page-${Date.now()}@bgvault.local`);
  for (let i = 0; i < 3; i += 1) {
    const created = await req('POST', '/api/credentials', {
      token: session.token,
      body: { type: 'note', name: `N${i}`, payload: { text: `t${i}` } },
    });
    assert.equal(created.status, 201);
  }

  const page = await req('GET', '/api/credentials?limit=2&offset=0', { token: session.token });
  assert.equal(page.status, 200);
  assert.equal(page.json.limit, 2);
  assert.equal(page.json.offset, 0);
  assert.equal(page.json.count, 2);

  const bad = await req('GET', '/api/credentials?limit=0', { token: session.token });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.code, 'VALIDATION');
});

test('maxReveals agotado responde 410 REVEAL_LIMIT', async () => {
  const session = await register(`one-${Date.now()}@bgvault.local`);
  const created = await req('POST', '/api/credentials', {
    token: session.token,
    body: {
      type: 'password',
      name: 'Once',
      maxReveals: 1,
      payload: { password: 'once-only-secret' },
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.credential.id;

  const first = await req('POST', `/api/credentials/${id}/reveal`, {
    token: session.token,
    body: {},
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.payload.password, 'once-only-secret');

  const second = await req('POST', `/api/credentials/${id}/reveal`, {
    token: session.token,
    body: {},
  });
  assert.equal(second.status, 410);
  assert.equal(second.json.error.code, 'REVEAL_LIMIT');
  assert.equal(second.json.payload, undefined);
});
