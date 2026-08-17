const { generateSecret } = require('../crypto/generate');
const auditStore = require('../store/auditStore');
const { sendOk, sendValidation } = require('../http/respond');

function generate(req, res) {
  const result = generateSecret(req.body || {});
  if (result.error) {
    return sendValidation(res, result.error);
  }

  try {
    auditStore.append({
      action: 'generate',
      userId: req.user.id,
      ok: true,
      detail: { kind: result.kind, length: result.length },
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }

  return sendOk(res, 200, {
    kind: result.kind,
    length: result.length,
    value: result.value,
    options: result.options,
  });
}

module.exports = {
  generate,
};
