const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/passwordController');

// Ruta para almacenar contraseñas (POST)
router.post('/', passwordController.storePassword);

// Ruta para obtener contraseñas (GET)
router.get('/', passwordController.getPasswords);

// Ruta para verificar una contraseña (POST)
router.post('/verify', passwordController.verifyPassword);

// Ruta para verificar todos los campos de un registro (POST)
router.post('/verify-all', passwordController.verifyAll);

module.exports = router;

