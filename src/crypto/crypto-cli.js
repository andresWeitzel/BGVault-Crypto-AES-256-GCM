#!/usr/bin/env node

/**
 * CLI para encriptación/desencriptación
 *
 * Este archivo actúa como "wrapper" de línea de comandos
 * alrededor del módulo genérico `lib.js`.
 *
 * Uso:
 *   node src/crypto/crypto-cli.js "valor a encriptar" [clave]
 *   node src/crypto/crypto-cli.js --decrypt "valor encriptado" [clave]
 */

const { encrypt, decrypt } = require('./lib');

// Usar la misma clave por defecto que en lib.js (por si el usuario pasa solo [clave])
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  'default-key-change-me-in-production-32chars!!';

// Exportar funciones para que otros módulos del proyecto puedan seguir usando este archivo
module.exports = { encrypt, decrypt };

// Si se ejecuta directamente desde la línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Uso: node src/crypto/crypto-cli.js "texto a encriptar" [clave]');
    console.error('   o: node src/crypto/crypto-cli.js --decrypt "texto encriptado" [clave]');
    process.exit(1);
  }
  
  if (args[0] === '--decrypt' || args[0] === '-d') {
    const encryptedText = args[1];
    const key = args[2] || ENCRYPTION_KEY;
    
    if (!encryptedText) {
      console.error('Error: Debes proporcionar el texto encriptado');
      process.exit(1);
    }
    
    try {
      const decrypted = decrypt(encryptedText, key);
      console.log(decrypted);
    } catch (error) {
      console.error('Error al desencriptar:', error.message);
      process.exit(1);
    }
  } else {
    const text = args[0];
    const key = args[1] || ENCRYPTION_KEY;
    
    const encrypted = encrypt(text, key);
    console.log(encrypted);
  }
}

