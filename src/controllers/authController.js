const crypto = require('node:crypto');
const jwt = require('../auth/jwt');
const { hashPassword, verifyPassword, dummyVerify } = require('../auth/password');
const usersStore = require('../store/usersStore');
const auditStore = require('../store/auditStore');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

function now() {
  return new Date().toISOString();
}

function audit({ action, userId = null, ok, detail = null, at }) {
  try {
    auditStore.append({ action, userId, ok, detail, at: at || now() });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function validateCredentials(email, password) {
  if (!email) return 'email es requerido';
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return 'email inválido';
  if (!password || typeof password !== 'string') return 'password es requerido';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `password no puede superar ${MAX_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}

function tokenResponse(user, message, status, timestamp) {
  const { token, expiresIn } = jwt.sign({ sub: user.id, email: user.email });
  return {
    status,
    body: {
      message,
      user: usersStore.toPublic(user),
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      timestamp,
    },
  };
}

function register(req, res) {
  const timestamp = now();
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const error = validateCredentials(email, password);
  if (error) {
    return res.status(400).json({ error, timestamp });
  }

  try {
    const user = usersStore.create({
      id: crypto.randomUUID(),
      email,
      passwordHash: hashPassword(password),
      createdAt: timestamp,
    });
    audit({ action: 'register', userId: user.id, ok: true, at: timestamp });
    const { status, body } = tokenResponse(user, 'Usuario registrado', 201, timestamp);
    return res.status(status).json(body);
  } catch (err) {
    if (usersStore.isUniqueConstraint(err)) {
      return res.status(409).json({
        error: 'Email ya registrado',
        timestamp,
      });
    }
    console.error('Error al registrar usuario:', err.message);
    return res.status(500).json({
      error: 'Error interno al registrar el usuario',
      timestamp,
    });
  }
}

function login(req, res) {
  const timestamp = now();
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !password || typeof password !== 'string') {
    return res.status(400).json({
      error: 'email y password son requeridos',
      timestamp,
    });
  }

  const user = usersStore.findByEmail(email);
  if (!user) {
    dummyVerify(password);
    audit({ action: 'login', ok: false, detail: { reason: 'invalid_credentials' }, at: timestamp });
    return res.status(401).json({
      error: 'Credenciales inválidas',
      timestamp,
    });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    audit({
      action: 'login',
      userId: user.id,
      ok: false,
      detail: { reason: 'invalid_credentials' },
      at: timestamp,
    });
    return res.status(401).json({
      error: 'Credenciales inválidas',
      timestamp,
    });
  }

  audit({ action: 'login', userId: user.id, ok: true, at: timestamp });
  const { status, body } = tokenResponse(user, 'Sesión iniciada', 200, timestamp);
  return res.status(status).json(body);
}

function me(req, res) {
  const user = usersStore.findById(req.user.id);
  if (!user) {
    return res.status(401).json({
      error: 'No autorizado',
      timestamp: now(),
    });
  }

  return res.json({
    user: usersStore.toPublic(user),
    timestamp: now(),
  });
}

module.exports = {
  register,
  login,
  me,
};
