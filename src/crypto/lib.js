const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const SALT_LENGTH = 64;
const MIN_KEY_LENGTH = 32;
const INSECURE_DEFAULT = 'default-key-change-me-in-production-32chars!!';

function resolveKey(key) {
  const resolved = key || process.env.ENCRYPTION_KEY;
  if (!resolved) {
    throw new Error('ENCRYPTION_KEY no configurada');
  }
  if (resolved === INSECURE_DEFAULT) {
    throw new Error('ENCRYPTION_KEY no puede ser la clave por defecto insegura');
  }
  if (resolved.length < MIN_KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY debe tener al menos ${MIN_KEY_LENGTH} caracteres`);
  }
  return resolved;
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function applyAad(cipherOrDecipher, aad) {
  if (aad === undefined || aad === null || aad === '') return;
  cipherOrDecipher.setAAD(Buffer.from(String(aad), 'utf8'));
}

/**
 * Encripta texto con AES-256-GCM.
 * @param {string} text
 * @param {string} [key]
 * @param {string} [aad] Additional Authenticated Data (ata el ciphertext a un contexto)
 */
function encrypt(text, key, aad) {
  if (typeof text !== 'string') {
    throw new Error('El texto a encriptar debe ser un string');
  }

  const resolvedKey = resolveKey(key);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(resolvedKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  applyAad(cipher, aad);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un blob `salt:iv:tag:encrypted`.
 * Acepta IV de 12 bytes (actual) o 16 bytes (legado).
 */
function decrypt(encryptedData, key, aad) {
  if (typeof encryptedData !== 'string') {
    throw new Error('Formato de datos encriptados inválido');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato de datos encriptados inválido');
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  if (iv.length !== IV_LENGTH && iv.length !== LEGACY_IV_LENGTH) {
    throw new Error('IV de longitud inválida');
  }

  const resolvedKey = resolveKey(key);
  const derivedKey = deriveKey(resolvedKey, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  applyAad(decipher, aad);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  IV_LENGTH,
  SALT_LENGTH,
};
