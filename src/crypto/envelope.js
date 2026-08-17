const crypto = require('node:crypto');
const { encrypt, decrypt, IV_LENGTH } = require('./lib');

const DEK_BYTES = 32;
const CIPHER_PREFIX = 'dek';
const ALGORITHM = 'aes-256-gcm';

function payloadAad(id, type, version) {
  return `credential:${id}:${type}:${version}`;
}

function dekAad(id, version) {
  return `dek:${id}:${version}`;
}

function generateDek() {
  return crypto.randomBytes(DEK_BYTES);
}

function encryptWithDek(plain, dek, aad) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
  if (aad) cipher.setAAD(Buffer.from(String(aad), 'utf8'));
  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decryptWithDek(blob, dek, aad) {
  const parts = String(blob || '').split(':');
  if (parts.length !== 4 || parts[0] !== CIPHER_PREFIX) {
    throw new Error('Formato envelope inválido');
  }

  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  if (iv.length !== IV_LENGTH || !tag.length || !encrypted) {
    throw new Error('Formato envelope inválido');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
  if (aad) decipher.setAAD(Buffer.from(String(aad), 'utf8'));
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function seal(plain, { id, type, version }) {
  const dek = generateDek();
  const aad = payloadAad(id, type, version);
  const ciphertext = encryptWithDek(plain, dek, aad);
  const wrappedDek = encrypt(dek.toString('hex'), undefined, dekAad(id, version));
  return { ciphertext, wrappedDek };
}

function open({ ciphertext, wrappedDek, id, type, version }) {
  const aad = payloadAad(id, type, version);
  if (!wrappedDek) {
    return decrypt(ciphertext, undefined, aad);
  }

  const dekHex = decrypt(wrappedDek, undefined, dekAad(id, version));
  const dek = Buffer.from(dekHex, 'hex');
  if (dek.length !== DEK_BYTES) {
    throw new Error('DEK inválida');
  }
  return decryptWithDek(ciphertext, dek, aad);
}

module.exports = {
  seal,
  open,
  payloadAad,
  CIPHER_PREFIX,
  DEK_BYTES,
};
