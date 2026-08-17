require('./config/env').loadAndValidate();
const sqlite = require('./db/sqlite');
sqlite.open();

const { createApp } = require('./app');
const app = createApp();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`BGVault corriendo en http://localhost:${PORT}`);
  console.log('Auth: JWT Bearer (POST /api/auth/register, /login; POST /api/auth/logout)');
  console.log(`SQLite: ${sqlite.resolveDbPath()}`);
  if (process.env.ENCRYPTION_KEY_NEXT) {
    console.log('KEK: ENCRYPTION_KEY_NEXT definida — seal usa la clave nueva; open acepta ambas. Corré npm run rewrap-keys y después promové las claves.');
  }
});

module.exports = { app, server };
