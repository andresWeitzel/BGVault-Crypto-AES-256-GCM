const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePaging(query = {}) {
  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (query.limit !== undefined && query.limit !== '') {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return { error: `limit debe ser un entero entre 1 y ${MAX_LIMIT}` };
    }
    limit = parsed;
  }

  if (query.offset !== undefined && query.offset !== '') {
    const parsed = Number(query.offset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: 'offset debe ser un entero mayor o igual a 0' };
    }
    offset = parsed;
  }

  return { limit, offset };
}

module.exports = {
  parsePaging,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
