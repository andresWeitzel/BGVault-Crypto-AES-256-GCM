const crypto = require('node:crypto');
const envelope = require('../crypto/envelope');
const store = require('../store/credentialsStore');
const auditStore = require('../store/auditStore');
const { CODES, sendOk, sendError, sendValidation, sendInternal } = require('../http/respond');

const CREDENTIAL_TYPES = ['password', 'api_key', 'token', 'note'];
const MAX_REVEALS = 10000;

function now() {
  return new Date().toISOString();
}

function revealsRemaining(credential) {
  if (credential.maxReveals == null) return null;
  return Math.max(0, credential.maxReveals - (credential.revealCount || 0));
}

function toPublic(credential) {
  return {
    id: credential.id,
    type: credential.type,
    name: credential.name,
    service: credential.service,
    tags: credential.tags,
    currentVersion: credential.currentVersion,
    version: credential.version ?? credential.currentVersion,
    expiresAt: credential.expiresAt || null,
    maxReveals: credential.maxReveals == null ? null : credential.maxReveals,
    revealCount: credential.revealCount || 0,
    revealsRemaining: revealsRemaining(credential),
    expired: store.isExpired(credential.expiresAt),
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
}

function ownerId(req) {
  return req.user.id;
}

function audit({ action, userId = null, credentialId = null, version = null, ok, detail = null, at }) {
  try {
    auditStore.append({ action, userId, credentialId, version, ok, detail, at: at || now() });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }
}

function parseExpiresAt(value) {
  if (value === undefined) return { omitted: true };
  if (value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { error: 'expiresAt debe ser un string ISO-8601' };
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return { error: 'expiresAt inválido' };
  if (ms <= Date.now()) return { error: 'expiresAt debe ser una fecha futura' };
  return { value: new Date(ms).toISOString() };
}

function parseMaxReveals(value) {
  if (value === undefined) return { omitted: true };
  if (value === null) return { value: null };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_REVEALS) {
    return { error: `maxReveals debe ser un entero entre 1 y ${MAX_REVEALS}` };
  }
  return { value: parsed };
}

function resolveLifecycle(body, previous) {
  const expires = parseExpiresAt(body?.expiresAt);
  if (expires.error) return { error: expires.error };
  const maxReveals = parseMaxReveals(body?.maxReveals);
  if (maxReveals.error) return { error: maxReveals.error };

  const resolvedExpires = expires.omitted ? (previous?.expiresAt ?? null) : expires.value;
  const resolvedMax = maxReveals.omitted ? (previous?.maxReveals ?? null) : maxReveals.value;

  if (resolvedExpires && Date.parse(resolvedExpires) <= Date.now()) {
    return { error: 'expiresAt debe ser una fecha futura' };
  }

  return { expiresAt: resolvedExpires, maxReveals: resolvedMax };
}

function sendConsumeError(res, action, userId, credentialId, result) {
  if (result.status === 'not_found') {
    audit({
      action,
      userId,
      credentialId,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }
  if (result.status === 'version_not_found') {
    audit({
      action,
      userId,
      credentialId,
      version: null,
      ok: false,
      detail: { reason: 'version_not_found' },
    });
    return sendError(res, 404, CODES.VERSION_NOT_FOUND, 'Versión no encontrada');
  }
  if (result.status === 'expired') {
    audit({
      action,
      userId,
      credentialId,
      version: result.record?.version,
      ok: false,
      detail: { reason: 'expired' },
    });
    return sendError(res, 410, CODES.CREDENTIAL_EXPIRED, 'Credencial vencida');
  }
  if (result.status === 'exhausted') {
    audit({
      action,
      userId,
      credentialId,
      version: result.record?.version,
      ok: false,
      detail: { reason: 'exhausted' },
    });
    return sendError(res, 410, CODES.REVEAL_LIMIT, 'Límite de revelaciones alcanzado');
  }
  return null;
}

function parseVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) return undefined;
  return version;
}

function normalizeTags(tags) {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) return null;
  if (!tags.every((tag) => typeof tag === 'string' && tag.trim())) return null;
  return [...new Set(tags.map((tag) => tag.trim()))];
}

function validatePayload(type, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'payload debe ser un objeto';
  }

  switch (type) {
    case 'password':
      if (!payload.password) return 'payload.password es requerido';
      break;
    case 'api_key':
      if (!payload.key) return 'payload.key es requerido';
      break;
    case 'token':
      if (!payload.token) return 'payload.token es requerido';
      break;
    case 'note':
      if (!payload.text) return 'payload.text es requerido';
      break;
    default:
      return `type debe ser uno de: ${CREDENTIAL_TYPES.join(', ')}`;
  }
  return null;
}

function encryptPayload(id, type, payload, version) {
  return envelope.seal(JSON.stringify(payload), { id, type, version });
}

function decryptPayload(credential) {
  return JSON.parse(
    envelope.open({
      ciphertext: credential.ciphertext,
      wrappedDek: credential.wrappedDek,
      id: credential.id,
      type: credential.type,
      version: credential.version,
    }),
  );
}

function createCredential(req, res) {
  const { type, name, service, tags, payload } = req.body || {};
  const timestamp = now();

  if (!type || !CREDENTIAL_TYPES.includes(type)) {
    return sendValidation(res, `type debe ser uno de: ${CREDENTIAL_TYPES.join(', ')}`);
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendValidation(res, 'name es requerido');
  }

  const payloadError = validatePayload(type, payload);
  if (payloadError) {
    return sendValidation(res, payloadError);
  }

  const lifecycle = resolveLifecycle(req.body, null);
  if (lifecycle.error) {
    return sendValidation(res, lifecycle.error);
  }

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags === null) {
    return sendValidation(res, 'tags debe ser un array de strings');
  }

  try {
    const id = crypto.randomUUID();
    const sealed = encryptPayload(id, type, payload, 1);
    const record = {
      id,
      userId: ownerId(req),
      type,
      name: name.trim(),
      service: service && String(service).trim() ? String(service).trim() : null,
      tags: normalizedTags,
      currentVersion: 1,
      ciphertext: sealed.ciphertext,
      wrappedDek: sealed.wrappedDek,
      expiresAt: lifecycle.expiresAt,
      maxReveals: lifecycle.maxReveals,
      revealCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.create(record);
    audit({
      action: 'create',
      userId: record.userId,
      credentialId: id,
      version: 1,
      ok: true,
      detail: { type, name: record.name },
      at: timestamp,
    });

    return sendOk(res, 201, {
      message: 'Credencial almacenada',
      credential: toPublic(record),
    });
  } catch (error) {
    return sendInternal(res, 'Error al almacenar la credencial', error);
  }
}

function listCredentials(req, res) {
  const { type, service } = req.query;
  if (type && !CREDENTIAL_TYPES.includes(type)) {
    return sendValidation(res, `type debe ser uno de: ${CREDENTIAL_TYPES.join(', ')}`);
  }

  const credentials = store.list({ userId: ownerId(req), type, service }).map(toPublic);
  return sendOk(res, 200, {
    credentials,
    count: credentials.length,
  });
}

function getCredential(req, res) {
  const credential = store.findById(req.params.id, ownerId(req));
  if (!credential) {
    audit({
      action: 'get',
      userId: ownerId(req),
      credentialId: req.params.id,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }

  audit({
    action: 'get',
    userId: ownerId(req),
    credentialId: credential.id,
    version: credential.currentVersion,
    ok: true,
  });
  return sendOk(res, 200, {
    credential: toPublic(credential),
  });
}

function listVersions(req, res) {
  const history = store.listVersions(req.params.id, ownerId(req));
  if (!history) {
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }

  audit({
    action: 'versions',
    userId: ownerId(req),
    credentialId: history.id,
    version: history.currentVersion,
    ok: true,
  });
  return sendOk(res, 200, {
    credential: {
      id: history.id,
      currentVersion: history.currentVersion,
    },
    versions: history.versions,
  });
}

function revealCredential(req, res) {
  const requestedVersion = parseVersion(req.body?.version);
  if (requestedVersion === undefined) {
    return sendValidation(res, 'version debe ser un entero mayor a 0');
  }

  try {
    const result = store.consumeUse(
      req.params.id,
      requestedVersion,
      ownerId(req),
      decryptPayload,
    );
    const blocked = sendConsumeError(res, 'reveal', ownerId(req), req.params.id, result);
    if (blocked) return blocked;

    audit({
      action: 'reveal',
      userId: ownerId(req),
      credentialId: result.record.id,
      version: result.record.version,
      ok: true,
    });
    return sendOk(res, 200, {
      credential: toPublic(result.record),
      payload: result.payload,
    });
  } catch (error) {
    return sendInternal(res, 'Error al revelar la credencial', error);
  }
}

function verifyCredential(req, res) {
  const meta = store.findById(req.params.id, ownerId(req));
  if (!meta) {
    audit({
      action: 'verify',
      userId: ownerId(req),
      credentialId: req.params.id,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }

  if (meta.type !== 'password') {
    return sendValidation(res, 'verify solo aplica a credenciales de tipo password');
  }

  const requestedVersion = parseVersion(req.body?.version);
  if (requestedVersion === undefined) {
    return sendValidation(res, 'version debe ser un entero mayor a 0');
  }

  const { password, username } = req.body || {};
  if (!password) {
    return sendValidation(res, 'password es requerido');
  }

  try {
    const result = store.consumeUse(
      req.params.id,
      requestedVersion,
      ownerId(req),
      decryptPayload,
    );
    const blocked = sendConsumeError(res, 'verify', ownerId(req), req.params.id, result);
    if (blocked) return blocked;

    const stored = result.payload;
    const verified = {
      password: password === stored.password,
    };
    if (username !== undefined) {
      verified.username = username === stored.username;
    }
    const isValid = Object.values(verified).every(Boolean);

    audit({
      action: 'verify',
      userId: ownerId(req),
      credentialId: result.record.id,
      version: result.record.version,
      ok: isValid,
      detail: { isValid },
    });

    return sendOk(res, 200, {
      credential: toPublic(result.record),
      isValid,
      verified,
      message: isValid ? 'Valores válidos' : 'Valores inválidos',
    });
  } catch (error) {
    return sendInternal(res, 'Error al verificar la credencial', error);
  }
}

function rotateCredential(req, res) {
  const timestamp = now();
  const credential = store.findById(req.params.id, ownerId(req));
  if (!credential) {
    audit({
      action: 'rotate',
      userId: ownerId(req),
      credentialId: req.params.id,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }

  const payloadError = validatePayload(credential.type, req.body?.payload);
  if (payloadError) {
    return sendValidation(res, payloadError);
  }

  const lifecycle = resolveLifecycle(req.body, credential);
  if (lifecycle.error) {
    return sendValidation(res, lifecycle.error);
  }

  try {
    const nextVersion = credential.currentVersion + 1;
    const sealed = encryptPayload(
      credential.id,
      credential.type,
      req.body.payload,
      nextVersion,
    );
    const rotated = store.rotate(credential.id, ownerId(req), {
      ciphertext: sealed.ciphertext,
      wrappedDek: sealed.wrappedDek,
      timestamp,
      expiresAt: lifecycle.expiresAt,
      maxReveals: lifecycle.maxReveals,
    });
    audit({
      action: 'rotate',
      userId: ownerId(req),
      credentialId: credential.id,
      version: rotated.currentVersion,
      ok: true,
      detail: { from: credential.currentVersion, to: rotated.currentVersion },
    });

    return sendOk(res, 200, {
      message: 'Credencial rotada',
      credential: toPublic(rotated),
    });
  } catch (error) {
    return sendInternal(res, 'Error al rotar la credencial', error);
  }
}

function deleteCredential(req, res) {
  const existing = store.findById(req.params.id, ownerId(req));
  const deleted = store.remove(req.params.id, ownerId(req));
  if (!deleted) {
    audit({
      action: 'delete',
      userId: ownerId(req),
      credentialId: req.params.id,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return sendError(res, 404, CODES.CREDENTIAL_NOT_FOUND, 'Credencial no encontrada');
  }

  audit({
    action: 'delete',
    userId: ownerId(req),
    credentialId: req.params.id,
    version: existing?.currentVersion ?? null,
    ok: true,
  });
  return sendOk(res, 200, {
    message: 'Credencial eliminada',
    id: req.params.id,
  });
}

module.exports = {
  createCredential,
  listCredentials,
  getCredential,
  listVersions,
  revealCredential,
  verifyCredential,
  rotateCredential,
  deleteCredential,
};
