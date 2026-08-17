require('./config/env').loadAndValidate();
const sqlite = require('./db/sqlite');
sqlite.open();

const { createApp } = require('./app');
const app = createApp();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`BGVault corriendo en http://${shown}:${PORT}`);
  console.log('Auth: JWT Bearer (POST /api/auth/register, /login; POST /api/auth/logout)');
  console.log(`SQLite: ${sqlite.resolveDbPath()}`);
  if (process.env.ENCRYPTION_KEY_NEXT) {
    console.log('KEK: ENCRYPTION_KEY_NEXT definida — seal usa la clave nueva; open acepta ambas. Corré npm run rewrap-keys y después promové las claves.');
  }
});

module.exports = { app, server };
