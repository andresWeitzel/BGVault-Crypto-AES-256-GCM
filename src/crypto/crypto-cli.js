#!/usr/bin/env node

/**
 * CLI de encriptación.
 *
 *   node src/crypto/crypto-cli.js "valor" [clave]
 *   node src/crypto/crypto-cli.js --decrypt "valor encriptado" [clave]
 */

require('../config/env').loadEnvFile();

const { encrypt, decrypt } = require('./lib');

module.exports = { encrypt, decrypt };

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Uso: node src/crypto/crypto-cli.js "texto" [clave]');
    console.error('  o: node src/crypto/crypto-cli.js --decrypt "texto encriptado" [clave]');
    process.exit(1);
  }

  try {
    if (args[0] === '--decrypt' || args[0] === '-d') {
      if (!args[1]) {
        throw new Error('Debes proporcionar el texto encriptado');
      }
      console.log(decrypt(args[1], args[2]));
    } else {
      console.log(encrypt(args[0], args[1]));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
