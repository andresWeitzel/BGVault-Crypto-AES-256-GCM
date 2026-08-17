const auditStore = require('../store/auditStore');

function listAudit(req, res) {
  const { action, credentialId, limit, offset } = req.query;
  const result = auditStore.list({
    userId: req.user.id,
    action,
    credentialId,
    limit,
    offset,
  });

  return res.json({
    ...result,
    count: result.events.length,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  listAudit,
};
