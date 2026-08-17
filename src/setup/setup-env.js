#!/usr/bin/env node

/**
 * Genera o completa .env con ENCRYPTION_KEY y JWT_SECRET.
 * Uso: npm run setup-env
 */

const fs = require('node:fs');
const crypto = require('node:crypto');
const { ENV_FILE, loadEnvFile, MIN_KEY_LENGTH, MIN_JWT_SECRET_LENGTH } = require('../config/env');

loadEnvFile();

const MANAGED_KEYS = ['PORT', 'ENCRYPTION_KEY', 'JWT_SECRET'];

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
  let jwtSecret = process.env.JWT_SECRET || existing.JWT_SECRET;
  const port = process.env.PORT || existing.PORT || '3000';

  if (!encryptionKey || encryptionKey.length < MIN_KEY_LENGTH) {
    encryptionKey = generateSecret(32);
    generated.push('ENCRYPTION_KEY');
  }
  if (!jwtSecret || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    jwtSecret = generateSecret(32);
    generated.push('JWT_SECRET');
  }

  const preserved = Object.entries(existing)
    .filter(([key]) => !MANAGED_KEYS.includes(key))
    .map(([key, value]) => `${key}=${value}`);

  const envContent = `# BGVault — no subas este archivo
PORT=${port}
ENCRYPTION_KEY=${encryptionKey}
JWT_SECRET=${jwtSecret}
${preserved.length ? `\n${preserved.join('\n')}\n` : ''}`;

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');

  console.log('Archivo .env listo:', ENV_FILE);
  if (generated.length) {
    console.log('Generado:', generated.join(', '));
  } else {
    console.log('Se conservaron ENCRYPTION_KEY y JWT_SECRET existentes.');
  }
  console.log('Auth: POST /api/auth/register o /api/auth/login → Bearer accessToken');
}

setupEnv();
