#!/usr/bin/env node

/**
 * Script para configurar el archivo .env con valores encriptados
 * Uso: npm run setup-env
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { encrypt } = require('../crypto/lib');

// Raíz del proyecto (dos niveles arriba de src/setup)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

// Obtener la clave de encriptación
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-me-in-production-32chars!!';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupEnv() {
  console.log('🔐 Configuración del archivo .env con valores encriptados\n');
  console.log('⚠️  IMPORTANTE: Guarda la clave de encriptación de forma segura!');
  console.log(`   Clave actual: ${ENCRYPTION_KEY.substring(0, 10)}...\n`);
  
  const password = await question('Contraseña a encriptar: ');
  const username = await question('Usuario (opcional, Enter para omitir): ') || 'N/A';
  const service = await question('Servicio (opcional, Enter para omitir): ') || 'N/A';
  
  // Encriptar valores
  const encryptedPassword = encrypt(password, ENCRYPTION_KEY);
  const encryptedUsername = encrypt(username, ENCRYPTION_KEY);
  const encryptedService = encrypt(service, ENCRYPTION_KEY);
  
  // Crear contenido del .env
  const envContent = `# Archivo de configuración para el cliente (valores encriptados)
# Edita estas variables según tus necesidades
# Para configurar nuevos valores, ejecuta: npm run setup-env
# Para ver valores desencriptados, ejecuta: npm run decrypt-env

PASSWORD_ENCRYPTED=${encryptedPassword}
USERNAME_ENCRYPTED=${encryptedUsername}
SERVICE_ENCRYPTED=${encryptedService}

# Clave de encriptación (NO compartas este archivo!)
# ENCRYPTION_KEY=${ENCRYPTION_KEY}
`;

  // Escribir archivo
  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  
  console.log('\n✅ Archivo .env creado con valores encriptados!');
  console.log(`   Ubicación: ${ENV_FILE}\n`);
  
  rl.close();
}

setupEnv().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

