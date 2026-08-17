const crypto = require('node:crypto');
const envelope = require('../crypto/envelope');
const store = require('../store/credentialsStore');
const auditStore = require('../store/auditStore');

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

function sendConsumeError(res, action, userId, credentialId, result, timestamp) {
  if (result.status === 'not_found') {
    audit({
      action,
      userId,
      credentialId,
      ok: false,
      detail: { reason: 'not_found' },
      at: timestamp,
    });
    return res.status(404).json({ error: 'Credencial no encontrada', timestamp });
  }
  if (result.status === 'version_not_found') {
    audit({
      action,
      userId,
      credentialId,
      version: null,
      ok: false,
      detail: { reason: 'version_not_found' },
      at: timestamp,
    });
    return res.status(404).json({ error: 'Versión no encontrada', timestamp });
  }
  if (result.status === 'expired') {
    audit({
      action,
      userId,
      credentialId,
      version: result.record?.version,
      ok: false,
      detail: { reason: 'expired' },
      at: timestamp,
    });
    return res.status(410).json({ error: 'Credencial vencida', timestamp });
  }
  if (result.status === 'exhausted') {
    audit({
      action,
      userId,
      credentialId,
      version: result.record?.version,
      ok: false,
      detail: { reason: 'exhausted' },
      at: timestamp,
    });
    return res.status(410).json({ error: 'Límite de revelaciones alcanzado', timestamp });
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
    return res.status(400).json({
      error: `type debe ser uno de: ${CREDENTIAL_TYPES.join(', ')}`,
      timestamp,
    });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: 'name es requerido',
      timestamp,
    });
  }

  const payloadError = validatePayload(type, payload);
  if (payloadError) {
    return res.status(400).json({ error: payloadError, timestamp });
  }

  const lifecycle = resolveLifecycle(req.body, null);
  if (lifecycle.error) {
    return res.status(400).json({ error: lifecycle.error, timestamp });
  }

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags === null) {
    return res.status(400).json({
      error: 'tags debe ser un array de strings',
      timestamp,
    });
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

    return res.status(201).json({
      message: 'Credencial almacenada',
      credential: toPublic(record),
      timestamp,
    });
  } catch (error) {
    console.error('Error al almacenar la credencial:', error.message);
    return res.status(500).json({
      error: 'Error interno al almacenar la credencial',
      timestamp,
    });
  }
}

function listCredentials(req, res) {
  const { type, service } = req.query;
  if (type && !CREDENTIAL_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type debe ser uno de: ${CREDENTIAL_TYPES.join(', ')}`,
      timestamp: now(),
    });
  }

  const credentials = store.list({ userId: ownerId(req), type, service }).map(toPublic);
  return res.json({
    credentials,
    count: credentials.length,
    timestamp: now(),
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
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'get',
    userId: ownerId(req),
    credentialId: credential.id,
    version: credential.currentVersion,
    ok: true,
  });
  return res.json({
    credential: toPublic(credential),
    timestamp: now(),
  });
}

function listVersions(req, res) {
  const history = store.listVersions(req.params.id, ownerId(req));
  if (!history) {
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'versions',
    userId: ownerId(req),
    credentialId: history.id,
    version: history.currentVersion,
    ok: true,
  });
  return res.json({
    id: history.id,
    currentVersion: history.currentVersion,
    versions: history.versions,
    timestamp: now(),
  });
}

function revealCredential(req, res) {
  const timestamp = now();
  const requestedVersion = parseVersion(req.body?.version);
  if (requestedVersion === undefined) {
    return res.status(400).json({
      error: 'version debe ser un entero mayor a 0',
      timestamp,
    });
  }

  try {
    const result = store.consumeUse(
      req.params.id,
      requestedVersion,
      ownerId(req),
      decryptPayload,
    );
    const blocked = sendConsumeError(
      res,
      'reveal',
      ownerId(req),
      req.params.id,
      result,
      timestamp,
    );
    if (blocked) return blocked;

    audit({
      action: 'reveal',
      userId: ownerId(req),
      credentialId: result.record.id,
      version: result.record.version,
      ok: true,
    });
    return res.json({
      id: result.record.id,
      type: result.record.type,
      name: result.record.name,
      service: result.record.service,
      version: result.record.version,
      currentVersion: result.record.currentVersion,
      expiresAt: result.record.expiresAt,
      maxReveals: result.record.maxReveals,
      revealsRemaining: revealsRemaining(result.record),
      payload: result.payload,
      timestamp,
    });
  } catch (error) {
    console.error('Error al revelar la credencial:', error.message);
    return res.status(500).json({
      error: 'Error interno al revelar la credencial',
      timestamp,
    });
  }
}

function verifyCredential(req, res) {
  const timestamp = now();
  const meta = store.findById(req.params.id, ownerId(req));
  if (!meta) {
    audit({
      action: 'verify',
      userId: ownerId(req),
      credentialId: req.params.id,
      ok: false,
      detail: { reason: 'not_found' },
    });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  if (meta.type !== 'password') {
    return res.status(400).json({
      error: 'verify solo aplica a credenciales de tipo password',
      timestamp,
    });
  }

  const requestedVersion = parseVersion(req.body?.version);
  if (requestedVersion === undefined) {
    return res.status(400).json({
      error: 'version debe ser un entero mayor a 0',
      timestamp,
    });
  }

  const { password, username } = req.body || {};
  if (!password) {
    return res.status(400).json({
      error: 'password es requerido',
      timestamp,
    });
  }

  try {
    const result = store.consumeUse(
      req.params.id,
      requestedVersion,
      ownerId(req),
      decryptPayload,
    );
    const blocked = sendConsumeError(
      res,
      'verify',
      ownerId(req),
      req.params.id,
      result,
      timestamp,
    );
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

    return res.json({
      id: result.record.id,
      version: result.record.version,
      isValid,
      verified,
      revealsRemaining: revealsRemaining(result.record),
      message: isValid ? 'Valores válidos' : 'Valores inválidos',
      timestamp,
    });
  } catch (error) {
    console.error('Error al verificar la credencial:', error.message);
    return res.status(500).json({
      error: 'Error interno al verificar la credencial',
      timestamp,
    });
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
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  const payloadError = validatePayload(credential.type, req.body?.payload);
  if (payloadError) {
    return res.status(400).json({ error: payloadError, timestamp });
  }

  const lifecycle = resolveLifecycle(req.body, credential);
  if (lifecycle.error) {
    return res.status(400).json({ error: lifecycle.error, timestamp });
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

    return res.json({
      message: 'Credencial rotada',
      credential: toPublic(rotated),
      timestamp,
    });
  } catch (error) {
    console.error('Error al rotar la credencial:', error.message);
    return res.status(500).json({
      error: 'Error interno al rotar la credencial',
      timestamp,
    });
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
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'delete',
    userId: ownerId(req),
    credentialId: req.params.id,
    version: existing?.currentVersion ?? null,
    ok: true,
  });
  return res.json({
    message: 'Credencial eliminada',
    id: req.params.id,
    timestamp: now(),
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
