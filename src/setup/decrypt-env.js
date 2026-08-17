#!/usr/bin/env node

const fs = require('node:fs');
const { decrypt } = require('../crypto/lib');
const { ENV_FILE, loadEnvFile, parseEnvLine } = require('../config/env');

loadEnvFile();

function decryptEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('No se encontró .env. Ejecuta: npm run setup-env');
    process.exit(1);
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error('Falta ENCRYPTION_KEY en el entorno o en .env');
    process.exit(1);
  }

  const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  let found = false;

  console.log('Valores *_ENCRYPTED en .env\n');

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed || !parsed.key.endsWith('_ENCRYPTED')) continue;

    const baseKey = parsed.key.replace(/_ENCRYPTED$/, '');
    found = true;

    try {
      console.log(`${baseKey}: ${decrypt(parsed.value)}`);
    } catch (error) {
      console.error(`${baseKey}: no se pudo desencriptar (${error.message})`);
    }
  }

  if (!found) {
    console.log('No hay variables *_ENCRYPTED. El vault guarda secretos vía API, no en este archivo.');
  }
}

decryptEnv();
