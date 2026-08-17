const { getDb, runInTransaction } = require('../db/sqlite');

const VERSION_COLUMNS = `
  v.version, v.ciphertext, v.wrapped_dek, v.expires_at, v.max_reveals,
  v.reveal_count, v.created_at AS version_created_at
`;

function parseTags(raw) {
  try {
    const tags = JSON.parse(raw || '[]');
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function isExpired(expiresAt, at = Date.now()) {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  return Number.isFinite(ms) && ms <= at;
}

function mapCredential(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    name: row.name,
    service: row.service,
    tags: parseTags(row.tags),
    currentVersion: row.current_version,
    version: row.version ?? row.current_version,
    ciphertext: row.ciphertext,
    wrappedDek: row.wrapped_dek || null,
    expiresAt: row.expires_at || null,
    maxReveals: row.max_reveals == null ? null : row.max_reveals,
    revealCount: row.reveal_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function create(record) {
  runInTransaction((db) => {
    db.prepare(
      `
      INSERT INTO credentials (id, user_id, type, name, service, tags, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      record.id,
      record.userId,
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
      INSERT INTO credential_versions (
        credential_id, version, ciphertext, wrapped_dek, expires_at, max_reveals, reveal_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `,
    ).run(
      record.id,
      record.currentVersion,
      record.ciphertext,
      record.wrappedDek || null,
      record.expiresAt || null,
      record.maxReveals == null ? null : record.maxReveals,
      record.createdAt,
    );
  });
  return record;
}

function findById(id, userId) {
  const row = getDb()
    .prepare(
      `
      SELECT c.id, c.user_id, c.type, c.name, c.service, c.tags, c.current_version,
             c.created_at, c.updated_at, ${VERSION_COLUMNS}
      FROM credentials c
      JOIN credential_versions v
        ON v.credential_id = c.id AND v.version = c.current_version
      WHERE c.id = ? AND c.user_id = ?
    `,
    )
    .get(id, userId);
  return mapCredential(row);
}

function findByIdAndVersion(id, version, userId) {
  const row = getDb()
    .prepare(
      `
      SELECT c.id, c.user_id, c.type, c.name, c.service, c.tags, c.current_version,
             c.created_at, c.updated_at, ${VERSION_COLUMNS}
      FROM credentials c
      JOIN credential_versions v
        ON v.credential_id = c.id AND v.version = ?
      WHERE c.id = ? AND c.user_id = ?
    `,
    )
    .get(version, id, userId);
  return mapCredential(row);
}

function list({ userId, type, service, limit = 50, offset = 0 } = {}) {
  let sql = `
    SELECT c.id, c.user_id, c.type, c.name, c.service, c.tags, c.current_version,
           c.created_at, c.updated_at, v.version, v.expires_at, v.max_reveals, v.reveal_count
    FROM credentials c
    JOIN credential_versions v
      ON v.credential_id = c.id AND v.version = c.current_version
    WHERE c.user_id = ?
  `;
  const params = [userId];
  if (type) {
    sql += ' AND c.type = ?';
    params.push(type);
  }
  if (service) {
    sql += ' AND c.service = ?';
    params.push(service);
  }
  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => mapCredential(row));
}

function updateMetadata(id, userId, { name, service, tags, timestamp }) {
  const updated = runInTransaction((db) => {
    const current = db
      .prepare(
        'SELECT name, service, tags FROM credentials WHERE id = ? AND user_id = ?',
      )
      .get(id, userId);
    if (!current) return null;

    const nextName = name !== undefined ? name : current.name;
    const nextService = service !== undefined ? service : current.service;
    const nextTags = tags !== undefined ? JSON.stringify(tags) : current.tags;

    db.prepare(
      `
      UPDATE credentials
      SET name = ?, service = ?, tags = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
    ).run(nextName, nextService, nextTags, timestamp, id, userId);
    return true;
  });

  if (!updated) return null;
  return findById(id, userId);
}

function rewrapDeks(rewrapFn) {
  return runInTransaction((db) => {
    const rows = db
      .prepare(
        `
        SELECT c.id, v.version, v.wrapped_dek
        FROM credentials c
        JOIN credential_versions v ON v.credential_id = c.id
        ORDER BY c.id, v.version
      `,
      )
      .all();

    const stats = { rewrapped: 0, already: 0, skippedLegacy: 0, failed: 0 };
    const update = db.prepare(
      `
      UPDATE credential_versions
      SET wrapped_dek = ?
      WHERE credential_id = ? AND version = ?
    `,
    );

    for (const row of rows) {
      if (!row.wrapped_dek) {
        stats.skippedLegacy += 1;
        continue;
      }
      const result = rewrapFn({
        id: row.id,
        version: row.version,
        wrappedDek: row.wrapped_dek,
      });
      if (result.status === 'rewrapped') {
        update.run(result.wrappedDek, row.id, row.version);
        stats.rewrapped += 1;
      } else if (result.status === 'already') {
        stats.already += 1;
      } else {
        stats.failed += 1;
      }
    }

    return stats;
  });
}

function listVersions(id, userId) {
  const credential = getDb()
    .prepare(
      'SELECT id, current_version, created_at, updated_at FROM credentials WHERE id = ? AND user_id = ?',
    )
    .get(id, userId);
  if (!credential) return null;

  const versions = getDb()
    .prepare(
      `
      SELECT version, created_at, expires_at, max_reveals, reveal_count
      FROM credential_versions
      WHERE credential_id = ?
      ORDER BY version ASC
    `,
    )
    .all(id)
    .map((row) => ({
      version: row.version,
      createdAt: row.created_at,
      expiresAt: row.expires_at || null,
      maxReveals: row.max_reveals == null ? null : row.max_reveals,
      revealCount: row.reveal_count ?? 0,
      revealsRemaining:
        row.max_reveals == null ? null : Math.max(0, row.max_reveals - (row.reveal_count ?? 0)),
      expired: isExpired(row.expires_at),
    }));

  return {
    id: credential.id,
    currentVersion: credential.current_version,
    versions,
  };
}

function rotate(id, userId, { ciphertext, wrappedDek, timestamp, expiresAt, maxReveals }) {
  const nextVersion = runInTransaction((db) => {
    const current = db
      .prepare('SELECT current_version FROM credentials WHERE id = ? AND user_id = ?')
      .get(id, userId);
    if (!current) return null;
    const version = current.current_version + 1;
    db.prepare(
      `
      INSERT INTO credential_versions (
        credential_id, version, ciphertext, wrapped_dek, expires_at, max_reveals, reveal_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `,
    ).run(
      id,
      version,
      ciphertext,
      wrappedDek || null,
      expiresAt || null,
      maxReveals == null ? null : maxReveals,
      timestamp,
    );
    db.prepare(
      `
      UPDATE credentials
      SET current_version = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
    ).run(version, timestamp, id, userId);
    return version;
  });

  if (nextVersion == null) return null;
  return findById(id, userId);
}

function exists(id, userId) {
  return Boolean(
    getDb().prepare('SELECT 1 FROM credentials WHERE id = ? AND user_id = ?').get(id, userId),
  );
}

function remove(id, userId) {
  const result = getDb()
    .prepare('DELETE FROM credentials WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return result.changes > 0;
}

function consumeUse(id, requestedVersion, userId, decryptFn) {
  return runInTransaction((db) => {
    const owned = db
      .prepare('SELECT 1 FROM credentials WHERE id = ? AND user_id = ?')
      .get(id, userId);
    if (!owned) return { status: 'not_found' };

    const row =
      requestedVersion == null
        ? db
            .prepare(
              `
              SELECT c.id, c.user_id, c.type, c.name, c.service, c.tags, c.current_version,
                     c.created_at, c.updated_at, ${VERSION_COLUMNS}
              FROM credentials c
              JOIN credential_versions v
                ON v.credential_id = c.id AND v.version = c.current_version
              WHERE c.id = ? AND c.user_id = ?
            `,
            )
            .get(id, userId)
        : db
            .prepare(
              `
              SELECT c.id, c.user_id, c.type, c.name, c.service, c.tags, c.current_version,
                     c.created_at, c.updated_at, ${VERSION_COLUMNS}
              FROM credentials c
              JOIN credential_versions v
                ON v.credential_id = c.id AND v.version = ?
              WHERE c.id = ? AND c.user_id = ?
            `,
            )
            .get(requestedVersion, id, userId);

    if (!row) return { status: 'version_not_found' };

    if (isExpired(row.expires_at)) {
      return { status: 'expired', record: mapCredential(row) };
    }
    if (row.max_reveals != null && row.reveal_count >= row.max_reveals) {
      return { status: 'exhausted', record: mapCredential(row) };
    }

    db.prepare(
      `
      UPDATE credential_versions
      SET reveal_count = reveal_count + 1
      WHERE credential_id = ? AND version = ?
    `,
    ).run(row.id, row.version);

    const record = mapCredential({ ...row, reveal_count: row.reveal_count + 1 });
    const payload = decryptFn(record);
    return { status: 'ok', record, payload };
  });
}

module.exports = {
  create,
  findById,
  findByIdAndVersion,
  list,
  listVersions,
  updateMetadata,
  rotate,
  exists,
  remove,
  consumeUse,
  rewrapDeks,
  isExpired,
};
