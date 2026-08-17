const express = require('express');
const credentialController = require('../controllers/credentialController');
const { limitReveal } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', credentialController.createCredential);
router.get('/', credentialController.listCredentials);
router.get('/:id/versions', credentialController.listVersions);
router.post('/:id/rotate', credentialController.rotateCredential);
router.get('/:id', credentialController.getCredential);
router.post('/:id/reveal', limitReveal, credentialController.revealCredential);
router.post('/:id/verify', limitReveal, credentialController.verifyCredential);
router.delete('/:id', credentialController.deleteCredential);

module.exports = router;
