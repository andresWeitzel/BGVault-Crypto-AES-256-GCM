#!/usr/bin/env node

/**
 * Reenvuelve wrapped_dek con ENCRYPTION_KEY_NEXT sin tocar el payload.
 * Uso: npm run rewrap-keys
 */

require('../config/env').loadAndValidate();
const sqlite = require('../db/sqlite');
const store = require('../store/credentialsStore');
const envelope = require('../crypto/envelope');

function rewrapKeys() {
  if (!envelope.nextKek()) {
    console.error('Falta ENCRYPTION_KEY_NEXT en el entorno o en .env');
    console.error('Definí una clave nueva (≥ 32 caracteres, distinta de ENCRYPTION_KEY) y volvé a correr.');
    process.exit(1);
  }

  sqlite.open();
  const stats = store.rewrapDeks((row) =>
    envelope.tryRewrapWrappedDek(row.wrappedDek, { id: row.id, version: row.version }),
  );

  console.log('Re-wrap de DEKs listo (el ciphertext no se tocó).');
  console.log(`  rewrapped:     ${stats.rewrapped}`);
  console.log(`  already:       ${stats.already}`);
  console.log(`  skippedLegacy: ${stats.skippedLegacy}`);
  console.log(`  failed:        ${stats.failed}`);

  if (stats.failed) {
    console.error('Hay versiones que no se pudieron abrir con ENCRYPTION_KEY ni ENCRYPTION_KEY_NEXT.');
    process.exit(1);
  }

  if (stats.skippedLegacy) {
    console.log('Las versiones legado (sin wrapped_dek) siguen atadas a ENCRYPTION_KEY: rotá esas credenciales para pasarlas a envelope.');
  }

  console.log('\nSiguiente paso:');
  console.log('  1. Copiá ENCRYPTION_KEY_NEXT sobre ENCRYPTION_KEY');
  console.log('  2. Borrá ENCRYPTION_KEY_NEXT');
  console.log('  3. Reiniciá el servidor');
}

rewrapKeys();
