const auditStore = require('../store/auditStore');
const { sendOk, sendValidation } = require('../http/respond');
const { parsePaging } = require('../http/paging');

function listAudit(req, res) {
  const { action, credentialId } = req.query;
  const paging = parsePaging(req.query);
  if (paging.error) {
    return sendValidation(res, paging.error);
  }

  const result = auditStore.list({
    userId: req.user.id,
    action,
    credentialId,
    limit: paging.limit,
    offset: paging.offset,
  });

  return sendOk(res, 200, {
    ...result,
    count: result.events.length,
  });
}

module.exports = {
  listAudit,
};
