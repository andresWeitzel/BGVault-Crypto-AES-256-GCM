const crypto = require('node:crypto');
const jwt = require('../auth/jwt');
const { hashPassword, verifyPassword, dummyVerify } = require('../auth/password');
const usersStore = require('../store/usersStore');
const auditStore = require('../store/auditStore');
const { CODES, sendOk, sendError, sendValidation, sendInternal } = require('../http/respond');

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

function tokenBody(user, message) {
  const { token, expiresIn } = jwt.sign({ sub: user.id, email: user.email });
  return {
    message,
    user: usersStore.toPublic(user),
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
  };
}

function register(req, res) {
  const timestamp = now();
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const error = validateCredentials(email, password);
  if (error) {
    return sendValidation(res, error);
  }

  try {
    const user = usersStore.create({
      id: crypto.randomUUID(),
      email,
      passwordHash: hashPassword(password),
      createdAt: timestamp,
    });
    audit({ action: 'register', userId: user.id, ok: true, at: timestamp });
    return sendOk(res, 201, tokenBody(user, 'Usuario registrado'));
  } catch (err) {
    if (usersStore.isUniqueConstraint(err)) {
      return sendError(res, 409, CODES.EMAIL_TAKEN, 'Email ya registrado');
    }
    return sendInternal(res, 'Error al registrar usuario', err);
  }
}

function login(req, res) {
  const timestamp = now();
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !password || typeof password !== 'string') {
    return sendValidation(res, 'email y password son requeridos');
  }

  const user = usersStore.findByEmail(email);
  if (!user) {
    dummyVerify(password);
    audit({ action: 'login', ok: false, detail: { reason: 'invalid_credentials' }, at: timestamp });
    return sendError(res, 401, CODES.INVALID_CREDENTIALS, 'Credenciales inválidas');
  }

  if (!verifyPassword(password, user.passwordHash)) {
    audit({
      action: 'login',
      userId: user.id,
      ok: false,
      detail: { reason: 'invalid_credentials' },
      at: timestamp,
    });
    return sendError(res, 401, CODES.INVALID_CREDENTIALS, 'Credenciales inválidas');
  }

  audit({ action: 'login', userId: user.id, ok: true, at: timestamp });
  return sendOk(res, 200, tokenBody(user, 'Sesión iniciada'));
}

function me(req, res) {
  const user = usersStore.findById(req.user.id);
  if (!user) {
    return sendError(res, 401, CODES.UNAUTHORIZED, 'No autorizado');
  }

  return sendOk(res, 200, {
    user: usersStore.toPublic(user),
  });
}

module.exports = {
  register,
  login,
  me,
};
