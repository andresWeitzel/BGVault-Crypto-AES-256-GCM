require('./config/env').loadAndValidate();
const sqlite = require('./db/sqlite');
sqlite.open();

const express = require('express');
const authRoutes = require('./routes/authRoutes');
const generateRoutes = require('./routes/generateRoutes');
const credentialRoutes = require('./routes/credentialRoutes');
const auditRoutes = require('./routes/auditRoutes');
const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(express.json({ limit: '32kb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    persistence: 'sqlite',
    auth: 'jwt',
    crypto: 'envelope',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/generate', requireAuth, generateRoutes);
app.use('/api/credentials', requireAuth, credentialRoutes);
app.use('/api/audit', requireAuth, auditRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON inválido',
      timestamp: new Date().toISOString(),
    });
  }
  console.error('Error no controlado:', err.message);
  return res.status(500).json({
    error: 'Error interno',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`BGVault corriendo en http://localhost:${PORT}`);
  console.log('Auth: JWT Bearer (POST /api/auth/register o /api/auth/login)');
  console.log(`SQLite: ${sqlite.resolveDbPath()}`);
});

module.exports = app;
