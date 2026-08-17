const auditStore = require('../store/auditStore');
const { sendOk } = require('../http/respond');

function listAudit(req, res) {
  const { action, credentialId, limit, offset } = req.query;
  const result = auditStore.list({
    userId: req.user.id,
    action,
    credentialId,
    limit,
    offset,
  });

  return sendOk(res, 200, {
    ...result,
    count: result.events.length,
  });
}

module.exports = {
  listAudit,
};
