const express = require('express');
const generateController = require('../controllers/generateController');

const router = express.Router();

router.post('/', generateController.generate);

module.exports = router;
