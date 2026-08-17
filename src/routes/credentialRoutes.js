const express = require('express');
const credentialController = require('../controllers/credentialController');

const router = express.Router();

router.post('/', credentialController.createCredential);
router.get('/', credentialController.listCredentials);
router.get('/:id', credentialController.getCredential);
router.post('/:id/reveal', credentialController.revealCredential);
router.post('/:id/verify', credentialController.verifyCredential);
router.delete('/:id', credentialController.deleteCredential);

module.exports = router;
