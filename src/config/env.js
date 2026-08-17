const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const MIN_KEY_LENGTH = 32;
const MIN_API_KEY_LENGTH = 16;
const INSECURE_DEFAULT = 'default-key-change-me-in-production-32chars!!';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;

  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(filePath = ENV_FILE) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function validateEnvConfig() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const apiKey = process.env.API_KEY;
  const errors = [];

  if (!encryptionKey) {
    errors.push('Falta ENCRYPTION_KEY');
  } else if (encryptionKey === INSECURE_DEFAULT) {
    errors.push('ENCRYPTION_KEY no puede ser la clave por defecto insegura');
  } else if (encryptionKey.length < MIN_KEY_LENGTH) {
    errors.push(`ENCRYPTION_KEY debe tener al menos ${MIN_KEY_LENGTH} caracteres`);
  }

  if (!apiKey) {
    errors.push('Falta API_KEY');
  } else if (apiKey.length < MIN_API_KEY_LENGTH) {
    errors.push(`API_KEY debe tener al menos ${MIN_API_KEY_LENGTH} caracteres`);
  }

  if (errors.length) {
    console.error('Configuración inválida:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nEjecuta: npm run setup-env');
    process.exit(1);
  }
}

function loadAndValidate() {
  loadEnvFile();
  validateEnvConfig();
}

module.exports = {
  PROJECT_ROOT,
  ENV_FILE,
  loadEnvFile,
  loadAndValidate,
  parseEnvLine,
  MIN_KEY_LENGTH,
  MIN_API_KEY_LENGTH,
};
