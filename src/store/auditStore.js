const { getDb } = require('../db/sqlite');

function append({ action, credentialId = null, version = null, ok, detail = null, at }) {
  getDb()
    .prepare(
      `
      INSERT INTO audit_events (at, action, credential_id, version, ok, detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      at || new Date().toISOString(),
      action,
      credentialId,
      version,
      ok ? 1 : 0,
      detail ? JSON.stringify(detail) : null,
    );
}

function list({ action, credentialId, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let sql = `
    SELECT id, at, action, credential_id, version, ok, detail
    FROM audit_events
    WHERE 1 = 1
  `;
  const params = [];
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (credentialId) {
    sql += ' AND credential_id = ?';
    params.push(credentialId);
  }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  const events = getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action,
      credentialId: row.credential_id,
      version: row.version,
      ok: row.ok === 1,
      detail: row.detail ? JSON.parse(row.detail) : null,
    }));

  return { events, limit: safeLimit, offset: safeOffset };
}

module.exports = {
  append,
  list,
};
