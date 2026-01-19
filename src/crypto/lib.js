const crypto = require('node:crypto');

// Obtener la clave de encriptación desde variable de entorno o usar una por defecto
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  'default-key-change-me-in-production-32chars!!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

// Función para derivar una clave de 32 bytes desde una clave de texto
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// Función para encriptar
function encrypt(text, key = ENCRYPTION_KEY) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(key, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Retornar: salt:iv:tag:encrypted (todo en hex)
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString(
    'hex',
  )}:${encrypted}`;
}

// Función para desencriptar
function decrypt(encryptedData, key = ENCRYPTION_KEY) {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato de datos encriptados inválido');
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const derivedKey = deriveKey(key, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
};


