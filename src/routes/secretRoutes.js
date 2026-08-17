const express = require('express');
const secretController = require('../controllers/secretController');

const router = express.Router();

router.post('/', secretController.createSecret);
router.get('/', secretController.listSecrets);
router.get('/:id', secretController.getSecret);
router.post('/:id/reveal', secretController.revealSecret);
router.post('/:id/verify', secretController.verifySecret);
router.delete('/:id', secretController.deleteSecret);

module.exports = router;
