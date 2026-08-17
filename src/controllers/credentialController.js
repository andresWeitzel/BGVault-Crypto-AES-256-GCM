const crypto = require('node:crypto');
const { encrypt, decrypt } = require('../crypto/lib');
const store = require('../store/credentialsStore');

const CREDENTIAL_TYPES = ['password', 'api_key', 'token', 'note'];

function now() {
  return new Date().toISOString();
}

function aadFor(id, type) {
  return `credential:${id}:${type}`;
}

function toPublic(credential) {
  return {
    id: credential.id,
    type: credential.type,
    name: credential.name,
    service: credential.service,
    tags: credential.tags,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
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

function encryptPayload(id, type, payload) {
  return encrypt(JSON.stringify(payload), undefined, aadFor(id, type));
}

function decryptPayload(credential) {
  return JSON.parse(
    decrypt(credential.ciphertext, undefined, aadFor(credential.id, credential.type)),
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
      ciphertext: encryptPayload(id, type, payload),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.create(record);

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
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  return res.json({
    credential: toPublic(credential),
    timestamp: now(),
  });
}

function revealCredential(req, res) {
  const credential = store.findById(req.params.id);
  if (!credential) {
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

  try {
    const payload = decryptPayload(credential);
    return res.json({
      id: credential.id,
      type: credential.type,
      name: credential.name,
      service: credential.service,
      payload,
      timestamp: now(),
    });
  } catch (error) {
    console.error('Error al revelar la credencial:', error.message);
    return res.status(500).json({
      error: 'Error interno al revelar la credencial',
      timestamp: now(),
    });
  }
}

function verifyCredential(req, res) {
  const timestamp = now();
  const credential = store.findById(req.params.id);
  if (!credential) {
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp,
    });
  }

  if (credential.type !== 'password') {
    return res.status(400).json({
      error: 'verify solo aplica a credenciales de tipo password',
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

    return res.json({
      id: credential.id,
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

function deleteCredential(req, res) {
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      error: 'Credencial no encontrada',
      timestamp: now(),
    });
  }

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
  revealCredential,
  verifyCredential,
  deleteCredential,
};
