const jwt = require('../auth/jwt');
const usersStore = require('../store/usersStore');

function unauthorized(res) {
  return res.status(401).json({
    error: 'No autorizado',
    timestamp: new Date().toISOString(),
  });
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return unauthorized(res);
  }

  const token = authorization.slice(7).trim();
  const payload = jwt.verify(token);
  if (!payload) {
    return unauthorized(res);
  }

  const user = usersStore.findById(payload.sub);
  if (!user) {
    return unauthorized(res);
  }

  req.user = { id: user.id, email: user.email };
  return next();
}

module.exports = requireAuth;
