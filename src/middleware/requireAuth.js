const jwt = require('../auth/jwt');
const usersStore = require('../store/usersStore');
const { CODES, sendError } = require('../http/respond');

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return sendError(res, 401, CODES.UNAUTHORIZED, 'No autorizado');
  }

  const token = authorization.slice(7).trim();
  const payload = jwt.verify(token);
  if (!payload) {
    return sendError(res, 401, CODES.UNAUTHORIZED, 'No autorizado');
  }

  const user = usersStore.findById(payload.sub);
  if (!user) {
    return sendError(res, 401, CODES.UNAUTHORIZED, 'No autorizado');
  }

  req.user = { id: user.id, email: user.email };
  return next();
}

module.exports = requireAuth;
