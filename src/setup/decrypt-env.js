#!/usr/bin/env node

/**
 * Script para desencriptar y mostrar los valores del archivo .env
 * Uso: npm run decrypt-env
 * 
 * Nota: Este script lee el archivo .env y desencripta los valores
 * encriptados para mostrarlos de forma legible.
 */

const fs = require('node:fs');
const path = require('node:path');
const { decrypt } = require('../crypto/lib');

// Raíz del proyecto (dos niveles arriba de src/setup)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

// Obtener la clave de encriptación
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-me-in-production-32chars!!';

function decryptEnv() {
  // Verificar que el archivo .env existe
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ Error: No se encontró el archivo .env');
    console.error(`   Ubicación esperada: ${ENV_FILE}\n`);
    console.log('💡 Para crear el archivo .env, ejecuta:');
    console.log('   npm run setup-env\n');
    process.exit(1);
  }

  // Leer el archivo .env
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const lines = envContent.split('\n');

  console.log('🔓 Desencriptando valores del archivo .env\n');
  console.log('⚠️  IMPORTANTE: Estos son valores sensibles. No compartas esta información!\n');
  console.log('─'.repeat(60));

  let foundEncrypted = false;

  // Procesar cada línea del archivo .env
  for (const line of lines) {
    // Ignorar líneas vacías y comentarios
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Buscar variables que terminen en _ENCRYPTED
    const match = line.match(/^([A-Z_]+_ENCRYPTED)=(.*)$/);
    if (match) {
      const key = match[1];
      const encryptedValue = match[2].trim();

      // Obtener el nombre de la variable sin _ENCRYPTED
      const baseKey = key.replace(/_ENCRYPTED$/, '');

      // Verificar que el valor tiene el formato esperado (salt:iv:tag:cipher)
      if (encryptedValue.includes(':') && encryptedValue.split(':').length === 4) {
        try {
          const decryptedValue = decrypt(encryptedValue, ENCRYPTION_KEY);
          console.log(`${baseKey}: ${decryptedValue}`);
          foundEncrypted = true;
        } catch (error) {
          console.error(`❌ Error al desencriptar ${baseKey}: ${error.message}`);
        }
      } else {
        console.log(`${baseKey}: [valor no encriptado o formato inválido]`);
      }
    }
  }

  console.log('─'.repeat(60));

  if (!foundEncrypted) {
    console.log('\n⚠️  No se encontraron valores encriptados en el archivo .env');
    console.log('   El archivo puede estar vacío o no contener valores encriptados.\n');
  } else {
    console.log('\n✅ Valores desencriptados exitosamente\n');
  }
}

decryptEnv();

