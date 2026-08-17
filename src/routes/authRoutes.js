const express = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');
const { limitAuth } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', limitAuth, authController.register);
router.post('/login', limitAuth, authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
