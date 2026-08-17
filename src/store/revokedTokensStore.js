const { getDb } = require('../db/sqlite');

function pruneExpired(now = Math.floor(Date.now() / 1000)) {
  getDb().prepare('DELETE FROM revoked_tokens WHERE exp < ?').run(now);
}

function revoke({ jti, userId, exp }) {
  pruneExpired();
  getDb()
    .prepare(
      `
      INSERT OR IGNORE INTO revoked_tokens (jti, user_id, exp, revoked_at)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(jti, userId, exp, new Date().toISOString());
}

function isRevoked(jti) {
  if (!jti) return true;
  pruneExpired();
  return Boolean(
    getDb().prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(jti),
  );
}

module.exports = {
  revoke,
  isRevoked,
  pruneExpired,
};
