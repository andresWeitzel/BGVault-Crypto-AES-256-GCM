#!/usr/bin/env node

/**
 * Genera o completa .env con ENCRYPTION_KEY y API_KEY.
 * Uso: npm run setup-env
 */

const fs = require('node:fs');
const crypto = require('node:crypto');
const { ENV_FILE, loadEnvFile, MIN_KEY_LENGTH, MIN_API_KEY_LENGTH } = require('../config/env');

const LOCAL_API_KEY = 'bgvault-dev-api-key-local';

loadEnvFile();

function generateSecret(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function currentEnvMap() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const map = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return map;
}

function setupEnv() {
  const existing = currentEnvMap();
  const generated = [];

  let encryptionKey = process.env.ENCRYPTION_KEY || existing.ENCRYPTION_KEY;
  let apiKey = process.env.API_KEY || existing.API_KEY;
  const port = process.env.PORT || existing.PORT || '3000';

  if (!encryptionKey || encryptionKey.length < MIN_KEY_LENGTH) {
    encryptionKey = generateSecret(32);
    generated.push('ENCRYPTION_KEY');
  }
  if (!apiKey || apiKey.length < MIN_API_KEY_LENGTH) {
    apiKey = LOCAL_API_KEY;
    generated.push('API_KEY');
  }

  const preserved = Object.entries(existing)
    .filter(([key]) => !['ENCRYPTION_KEY', 'API_KEY', 'PORT'].includes(key))
    .map(([key, value]) => `${key}=${value}`);

  const envContent = `# BGVault — no subas este archivo
PORT=${port}
ENCRYPTION_KEY=${encryptionKey}
API_KEY=${apiKey}
${preserved.length ? `\n${preserved.join('\n')}\n` : ''}`;

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');

  console.log('Archivo .env listo:', ENV_FILE);
  if (generated.length) {
    console.log('Generado:', generated.join(', '));
  } else {
    console.log('Se conservaron ENCRYPTION_KEY y API_KEY existentes.');
  }
  console.log('Postman: collection Crypto AES-256-GCM Vault → Variables → apiKey = bgvault-dev-api-key-local');
}

setupEnv();
