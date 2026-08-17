const crypto = require('node:crypto');
const { encrypt, decrypt } = require('../crypto/lib');
const store = require('../store/credentialsStore');
const auditStore = require('../store/auditStore');

const CREDENTIAL_TYPES = ['password', 'api_key', 'token', 'note'];

function now() {
  return new Date().toISOString();
}

function aadFor(id, type, version) {
  return `credential:${id}:${type}:${version}`;
}

function toPublic(credential) {
  return {
    id: credential.id,
    type: credential.type,
    name: credential.name,
    service: credential.service,
    tags: credential.tags,
    currentVersion: credential.currentVersion,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
}

function audit({ action, credentialId = null, version = null, ok, detail = null, at }) {
  try {
    auditStore.append({ action, credentialId, version, ok, detail, at: at || now() });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }
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
  return encrypt(JSON.stringify(payload), undefined, aadFor(id, type, version));
}

function decryptPayload(credential) {
  return JSON.parse(
    decrypt(
      credential.ciphertext,
      undefined,
      aadFor(credential.id, credential.type, credential.version),
    ),
  );
}

function resolveRecord(id, requestedVersion) {
  if (requestedVersion == null) return store.findById(id);
  return store.findByIdAndVersion(id, requestedVersion);
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

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags === null) {
    return res.status(400).json({
      error: 'tags debe ser un array de strings',
      timestamp,
    });
  }

  try {
    const id = crypto.randomUUID();
    const record = {
      id,
      type,
      name: name.trim(),
      service: service && String(service).trim() ? String(service).trim() : null,
      tags: normalizedTags,
      currentVersion: 1,
      ciphertext: encryptPayload(id, type, payload, 1),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.create(record);
    audit({
      action: 'create',
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

  const credentials = store.list({ type, service }).map(toPublic);
  return res.json({
    credentials,
    count: credentials.length,
    timestamp: now(),
  });
}

function getCredential(req, res) {
  const credential = store.findById(req.params.id);
  if (!credential) {
    audit({ action: 'get', credentialId: req.params.id, ok: false, detail: { reason: 'not_found' } });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'get',
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
  const history = store.listVersions(req.params.id);
  if (!history) {
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'versions',
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

  const exists = store.exists(req.params.id);
  if (!exists) {
    audit({ action: 'reveal', credentialId: req.params.id, ok: false, detail: { reason: 'not_found' } });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  const credential = resolveRecord(req.params.id, requestedVersion);
  if (!credential) {
    audit({
      action: 'reveal',
      credentialId: req.params.id,
      version: requestedVersion,
      ok: false,
      detail: { reason: 'version_not_found' },
    });
    return res.status(404).json({
      error: 'Versión no encontrada',
      timestamp,
    });
  }

  try {
    const payload = decryptPayload(credential);
    audit({
      action: 'reveal',
      credentialId: credential.id,
      version: credential.version,
      ok: true,
    });
    return res.json({
      id: credential.id,
      type: credential.type,
      name: credential.name,
      service: credential.service,
      version: credential.version,
      currentVersion: credential.currentVersion,
      payload,
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
  const exists = store.exists(req.params.id);
  if (!exists) {
    audit({ action: 'verify', credentialId: req.params.id, ok: false, detail: { reason: 'not_found' } });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  const meta = store.findById(req.params.id);
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

  const credential = resolveRecord(req.params.id, requestedVersion);
  if (!credential) {
    return res.status(404).json({
      error: 'Versión no encontrada',
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
    const stored = decryptPayload(credential);
    const verified = {
      password: password === stored.password,
    };
    if (username !== undefined) {
      verified.username = username === stored.username;
    }
    const isValid = Object.values(verified).every(Boolean);

    audit({
      action: 'verify',
      credentialId: credential.id,
      version: credential.version,
      ok: isValid,
      detail: { isValid },
    });

    return res.json({
      id: credential.id,
      version: credential.version,
      isValid,
      verified,
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
  const credential = store.findById(req.params.id);
  if (!credential) {
    audit({ action: 'rotate', credentialId: req.params.id, ok: false, detail: { reason: 'not_found' } });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  const payloadError = validatePayload(credential.type, req.body?.payload);
  if (payloadError) {
    return res.status(400).json({ error: payloadError, timestamp });
  }

  try {
    const nextVersion = credential.currentVersion + 1;
    const ciphertext = encryptPayload(
      credential.id,
      credential.type,
      req.body.payload,
      nextVersion,
    );
    const rotated = store.rotate(credential.id, { ciphertext, timestamp });
    audit({
      action: 'rotate',
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
  const existing = store.findById(req.params.id);
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    audit({ action: 'delete', credentialId: req.params.id, ok: false, detail: { reason: 'not_found' } });
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  audit({
    action: 'delete',
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
