const express = require('express');
const requestId = require('./middleware/requestId');
const { CODES, sendOk, sendError, sendInternal } = require('./http/respond');
const authRoutes = require('./routes/authRoutes');
const generateRoutes = require('./routes/generateRoutes');
const credentialRoutes = require('./routes/credentialRoutes');
const auditRoutes = require('./routes/auditRoutes');
const requireAuth = require('./middleware/requireAuth');
const { createIpRateLimit } = require('./middleware/rateLimit');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createIpRateLimit());

  app.get('/health', (req, res) => {
    return sendOk(res, 200, {
      status: 'OK',
      persistence: 'sqlite',
      auth: 'jwt',
      crypto: 'envelope',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/generate', requireAuth, generateRoutes);
  app.use('/api/credentials', requireAuth, credentialRoutes);
  app.use('/api/audit', requireAuth, auditRoutes);

  app.use((req, res) => {
    return sendError(res, 404, CODES.ROUTE_NOT_FOUND, 'Ruta no encontrada');
  });

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return sendError(res, 400, CODES.JSON_INVALID, 'JSON inválido');
    }
    return sendInternal(res, 'Error no controlado', err);
  });

  return app;
}

module.exports = { createApp };
