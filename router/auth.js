const router = require('express').Router();
const { login, register } = require('../controllers/authController');
const { verify } = require('../controllers/verificationController');
const { validate } = require('../validators/index');
const { rules: registrationRules } = require('../validators/auth/register');
const { rules: loginRules } = require('../validators/auth/login');

router.post('/login', [loginRules(), validate], login);
router.post('/register', [registrationRules(), validate], register);
router.get('/verification', verify);

module.exports = router;
