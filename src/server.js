require('./config/env').loadAndValidate();

const express = require('express');
const secretRoutes = require('./routes/secretRoutes');
const requireApiKey = require('./middleware/requireApiKey');

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
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/secrets', requireApiKey, secretRoutes);

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
  console.log('Auth: header X-API-Key o Authorization: Bearer');
});

module.exports = app;
