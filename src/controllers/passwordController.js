const { encrypt, decrypt } = require('../crypto/lib');

// Almacenamiento en memoria de las contraseñas (encriptadas)
const storedData = {
  passwords: []
};

// Obtener la clave de encriptación desde variable de entorno o usar una por defecto
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-me-in-production-32chars!!';

/**
 * Almacena una contraseña encriptada
 */
async function storePassword(req, res) {
  const { password, username, service } = req.body;
  const timestamp = new Date().toISOString();

  if (!password) {
    return res.status(400).json({
      error: 'La contraseña es requerida',
      timestamp
    });
  }

  try {
    // Encriptar los datos sensibles con AES-256-GCM antes de almacenarlos
    const passwordEncrypted = encrypt(password, ENCRYPTION_KEY);
    const usernameEncrypted = username
      ? encrypt(username, ENCRYPTION_KEY)
      : null;
    const serviceEncrypted = service
      ? encrypt(service, ENCRYPTION_KEY)
      : null;

    storedData.passwords.push({
      passwordEncrypted,
      usernameEncrypted,
      serviceEncrypted,
      timestamp
    });

    return res.json({
      message: 'Contraseña almacenada correctamente (encriptada con AES-256-GCM)',
      count: storedData.passwords.length,
      timestamp
    });
  } catch (error) {
    console.error('Error al encriptar la contraseña:', error);
    return res.status(500).json({
      error: 'Error interno al procesar la contraseña',
      timestamp
    });
  }
}

/**
 * Obtiene todas las contraseñas y metadatos almacenados (encriptados)
 * Opcionalmente puede desencriptar los valores si se proporciona la clave
 */
function getPasswords(req, res) {
  const { decrypt: shouldDecrypt } = req.query;
  
  // Formatear los datos con índices para facilitar la referencia
  const formattedPasswords = storedData.passwords.map((item, index) => {
    const result = {
      index,
      passwordEncrypted: item.passwordEncrypted,
      usernameEncrypted: item.usernameEncrypted,
      serviceEncrypted: item.serviceEncrypted,
      timestamp: item.timestamp
    };

    // Si se solicita desencriptar, intentar desencriptar los valores
    if (shouldDecrypt === 'true') {
      try {
        result.password = decrypt(item.passwordEncrypted, ENCRYPTION_KEY);
        if (item.usernameEncrypted) {
          result.username = decrypt(item.usernameEncrypted, ENCRYPTION_KEY);
        }
        if (item.serviceEncrypted) {
          result.service = decrypt(item.serviceEncrypted, ENCRYPTION_KEY);
        }
      } catch (error) {
        result.decryptError = 'Error al desencriptar: ' + error.message;
      }
    }

    return result;
  });

  res.json({
    message: 'Contraseñas almacenadas (encriptadas con AES-256-GCM)',
    note: shouldDecrypt === 'true' 
      ? 'Valores desencriptados mostrados' 
      : 'Para ver valores desencriptados, agrega ?decrypt=true a la URL',
    passwords: formattedPasswords,
    count: storedData.passwords.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * Verifica una contraseña desencriptando y comparando
 */
async function verifyPassword(req, res) {
  const { password, index } = req.body;
  const timestamp = new Date().toISOString();

  if (!password || index === undefined) {
    return res.status(400).json({
      error: 'La contraseña y el índice son requeridos',
      timestamp
    });
  }

  if (!storedData.passwords[index]) {
    return res.status(404).json({
      error: 'Contraseña no encontrada en el índice especificado',
      timestamp
    });
  }

  try {
    const { passwordEncrypted } = storedData.passwords[index];
    const decryptedPassword = decrypt(passwordEncrypted, ENCRYPTION_KEY);
    const isValid = password === decryptedPassword;

    return res.json({
      isValid,
      message: isValid ? 'Contraseña válida' : 'Contraseña inválida',
      index,
      timestamp
    });
  } catch (error) {
    console.error('Error al verificar la contraseña:', error);
    return res.status(500).json({
      error: 'Error interno al verificar la contraseña',
      timestamp
    });
  }
}

/**
 * Verifica todos los campos (password, username, service) de un registro
 */
async function verifyAll(req, res) {
  const { password, username, service, index } = req.body;
  const timestamp = new Date().toISOString();

  if (index === undefined) {
    return res.status(400).json({
      error: 'El índice es requerido',
      timestamp
    });
  }

  if (!storedData.passwords[index]) {
    return res.status(404).json({
      error: 'Registro no encontrado en el índice especificado',
      timestamp
    });
  }

  try {
    const stored = storedData.passwords[index];
    const results = {};

    if (password) {
      const decryptedPassword = decrypt(stored.passwordEncrypted, ENCRYPTION_KEY);
      results.password = password === decryptedPassword;
    }

    if (username && stored.usernameEncrypted) {
      const decryptedUsername = decrypt(stored.usernameEncrypted, ENCRYPTION_KEY);
      results.username = username === decryptedUsername;
    }

    if (service && stored.serviceEncrypted) {
      const decryptedService = decrypt(stored.serviceEncrypted, ENCRYPTION_KEY);
      results.service = service === decryptedService;
    }

    const allValid = Object.values(results).every(v => v === true);

    return res.json({
      index,
      verified: results,
      allValid,
      message: allValid ? 'Todos los valores coinciden' : 'Algunos valores no coinciden',
      timestamp
    });
  } catch (error) {
    console.error('Error al verificar los valores:', error);
    return res.status(500).json({
      error: 'Error interno al verificar los valores',
      timestamp
    });
  }
}

module.exports = {
  storePassword,
  getPasswords,
  verifyPassword,
  verifyAll
};

