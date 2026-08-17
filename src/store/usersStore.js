const { getDb } = require('../db/sqlite');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function toPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function create({ id, email, passwordHash, createdAt }) {
  getDb()
    .prepare(
      `
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(id, email, passwordHash, createdAt);
  return { id, email, passwordHash, createdAt };
}

function findById(id) {
  return mapUser(getDb().prepare('SELECT id, email, password_hash, created_at FROM users WHERE id = ?').get(id));
}

function findByEmail(email) {
  return mapUser(
    getDb()
      .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
      .get(email),
  );
}

function isUniqueConstraint(error) {
  const message = String(error && error.message);
  const code = String(error && error.code);
  return (
    code.includes('CONSTRAINT') ||
    message.includes('UNIQUE constraint failed') ||
    message.includes('constraint failed')
  );
}

module.exports = {
  create,
  findById,
  findByEmail,
  toPublic,
  isUniqueConstraint,
};
