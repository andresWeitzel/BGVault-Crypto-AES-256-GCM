const crypto = require('node:crypto');
const { encrypt, decrypt } = require('../crypto/lib');
const store = require('../store/secretsStore');

const SECRET_TYPES = ['password', 'api_key', 'token', 'note'];

function now() {
  return new Date().toISOString();
}

function aadFor(id, type) {
  return `secret:${id}:${type}`;
}

function toPublic(secret) {
  return {
    id: secret.id,
    type: secret.type,
    name: secret.name,
    service: secret.service,
    tags: secret.tags,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
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
      return `type debe ser uno de: ${SECRET_TYPES.join(', ')}`;
  }
  return null;
}

function encryptPayload(id, type, payload) {
  return encrypt(JSON.stringify(payload), undefined, aadFor(id, type));
}

function decryptPayload(secret) {
  return JSON.parse(decrypt(secret.ciphertext, undefined, aadFor(secret.id, secret.type)));
}

function createSecret(req, res) {
  const { type, name, service, tags, payload } = req.body || {};
  const timestamp = now();

  if (!type || !SECRET_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type debe ser uno de: ${SECRET_TYPES.join(', ')}`,
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
      message: 'Secreto almacenado',
      secret: toPublic(record),
      timestamp,
    });
  } catch (error) {
    console.error('Error al almacenar el secreto:', error.message);
    return res.status(500).json({
      error: 'Error interno al almacenar el secreto',
      timestamp,
    });
  }
}

function listSecrets(req, res) {
  const { type, service } = req.query;
  if (type && !SECRET_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type debe ser uno de: ${SECRET_TYPES.join(', ')}`,
      timestamp: now(),
    });
  }

  const secrets = store.list({ type, service }).map(toPublic);
  return res.json({
    secrets,
    count: secrets.length,
    timestamp: now(),
  });
}

function getSecret(req, res) {
  const secret = store.findById(req.params.id);
  if (!secret) {
    return res.status(404).json({
      error: 'Secreto no encontrado',
      timestamp: now(),
    });
  }

  return res.json({
    secret: toPublic(secret),
    timestamp: now(),
  });
}

function revealSecret(req, res) {
  const secret = store.findById(req.params.id);
  if (!secret) {
    return res.status(404).json({
      error: 'Secreto no encontrado',
      timestamp: now(),
    });
  }

  try {
    const payload = decryptPayload(secret);
    return res.json({
      id: secret.id,
      type: secret.type,
      name: secret.name,
      service: secret.service,
      payload,
      timestamp: now(),
    });
  } catch (error) {
    console.error('Error al revelar el secreto:', error.message);
    return res.status(500).json({
      error: 'Error interno al revelar el secreto',
      timestamp: now(),
    });
  }
}

function verifySecret(req, res) {
  const timestamp = now();
  const secret = store.findById(req.params.id);
  if (!secret) {
    return res.status(404).json({
      error: 'Secreto no encontrado',
      timestamp,
    });
  }

  if (secret.type !== 'password') {
    return res.status(400).json({
      error: 'verify solo aplica a secretos de tipo password',
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
    const stored = decryptPayload(secret);
    const verified = {
      password: password === stored.password,
    };
    if (username !== undefined) {
      verified.username = username === stored.username;
    }
    const isValid = Object.values(verified).every(Boolean);

    return res.json({
      id: secret.id,
      isValid,
      verified,
      message: isValid ? 'Valores válidos' : 'Valores inválidos',
      timestamp,
    });
  } catch (error) {
    console.error('Error al verificar el secreto:', error.message);
    return res.status(500).json({
      error: 'Error interno al verificar el secreto',
      timestamp,
    });
  }
}

function deleteSecret(req, res) {
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      error: 'Secreto no encontrado',
      timestamp: now(),
    });
  }

  return res.json({
    message: 'Secreto eliminado',
    id: req.params.id,
    timestamp: now(),
  });
}

module.exports = {
  createSecret,
  listSecrets,
  getSecret,
  revealSecret,
  verifySecret,
  deleteSecret,
};
