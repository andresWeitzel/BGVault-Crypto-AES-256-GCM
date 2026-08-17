const { generateSecret } = require('../crypto/generate');
const auditStore = require('../store/auditStore');

function generate(req, res) {
  const timestamp = new Date().toISOString();
  const result = generateSecret(req.body || {});
  if (result.error) {
    return res.status(400).json({ error: result.error, timestamp });
  }

  try {
    auditStore.append({
      action: 'generate',
      userId: req.user.id,
      ok: true,
      detail: { kind: result.kind, length: result.length },
      at: timestamp,
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }

  return res.json({
    kind: result.kind,
    length: result.length,
    value: result.value,
    options: result.options,
    timestamp,
  });
}

module.exports = {
  generate,
};
