const { getDb, runInTransaction } = require('../db/sqlite');

function parseTags(raw) {
  try {
    const tags = JSON.parse(raw || '[]');
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function mapCredential(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    service: row.service,
    tags: parseTags(row.tags),
    currentVersion: row.current_version,
    version: row.version ?? row.current_version,
    ciphertext: row.ciphertext,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function create(record) {
  runInTransaction((db) => {
    db.prepare(
      `
      INSERT INTO credentials (id, type, name, service, tags, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      record.id,
      record.type,
      record.name,
      record.service,
      JSON.stringify(record.tags || []),
      record.currentVersion,
      record.createdAt,
      record.updatedAt,
    );
    db.prepare(
      `
      INSERT INTO credential_versions (credential_id, version, ciphertext, created_at)
      VALUES (?, ?, ?, ?)
    `,
    ).run(record.id, record.currentVersion, record.ciphertext, record.createdAt);
  });
  return record;
}

function findById(id) {
  const row = getDb()
    .prepare(
      `
      SELECT c.id, c.type, c.name, c.service, c.tags, c.current_version,
             c.created_at, c.updated_at, v.version, v.ciphertext
      FROM credentials c
      JOIN credential_versions v
        ON v.credential_id = c.id AND v.version = c.current_version
      WHERE c.id = ?
    `,
    )
    .get(id);
  return mapCredential(row);
}

function findByIdAndVersion(id, version) {
  const row = getDb()
    .prepare(
      `
      SELECT c.id, c.type, c.name, c.service, c.tags, c.current_version,
             c.created_at, c.updated_at, v.version, v.ciphertext
      FROM credentials c
      JOIN credential_versions v
        ON v.credential_id = c.id AND v.version = ?
      WHERE c.id = ?
    `,
    )
    .get(version, id);
  return mapCredential(row);
}

function list({ type, service } = {}) {
  let sql = `
    SELECT id, type, name, service, tags, current_version, created_at, updated_at
    FROM credentials
    WHERE 1 = 1
  `;
  const params = [];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (service) {
    sql += ' AND service = ?';
    params.push(service);
  }
  sql += ' ORDER BY created_at DESC';

  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => mapCredential(row));
}

function listVersions(id) {
  const credential = getDb()
    .prepare(
      'SELECT id, current_version, created_at, updated_at FROM credentials WHERE id = ?',
    )
    .get(id);
  if (!credential) return null;

  const versions = getDb()
    .prepare(
      `
      SELECT version, created_at
      FROM credential_versions
      WHERE credential_id = ?
      ORDER BY version ASC
    `,
    )
    .all(id)
    .map((row) => ({ version: row.version, createdAt: row.created_at }));

  return {
    id: credential.id,
    currentVersion: credential.current_version,
    versions,
  };
}

function rotate(id, { ciphertext, timestamp }) {
  const nextVersion = runInTransaction((db) => {
    const current = db.prepare('SELECT current_version FROM credentials WHERE id = ?').get(id);
    if (!current) return null;
    const version = current.current_version + 1;
    db.prepare(
      `
      INSERT INTO credential_versions (credential_id, version, ciphertext, created_at)
      VALUES (?, ?, ?, ?)
    `,
    ).run(id, version, ciphertext, timestamp);
    db.prepare(
      `
      UPDATE credentials
      SET current_version = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(version, timestamp, id);
    return version;
  });

  if (nextVersion == null) return null;
  return findById(id);
}

function exists(id) {
  return Boolean(getDb().prepare('SELECT 1 FROM credentials WHERE id = ?').get(id));
}

function remove(id) {
  const result = getDb().prepare('DELETE FROM credentials WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  create,
  findById,
  findByIdAndVersion,
  list,
  listVersions,
  rotate,
  exists,
  remove,
};
