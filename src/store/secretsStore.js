const secrets = new Map();

function create(record) {
  secrets.set(record.id, record);
  return record;
}

function findById(id) {
  return secrets.get(id) || null;
}

function list({ type, service } = {}) {
  let items = [...secrets.values()];
  if (type) items = items.filter((item) => item.type === type);
  if (service) items = items.filter((item) => item.service === service);
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function remove(id) {
  return secrets.delete(id);
}

module.exports = {
  create,
  findById,
  list,
  remove,
};
