const router = require('express').Router();
const {
  login,
  register,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const {
  verify,
  getVerificationToken,
} = require('../controllers/verificationController');
const { validate } = require('../validators/index');
const { rules: registrationRules } = require('../validators/auth/register');
const { rules: loginRules } = require('../validators/auth/login');
const {
  rules: forgotPasswordRules,
} = require('../validators/auth/forgotPassword');

router.post('/login', [loginRules(), validate], login);
router.post('/register', [registrationRules(), validate], register);
router.get('/verification', verify);
router.post(
  '/forgot-password',
  [forgotPasswordRules(), validate],
  forgotPassword
);

router.post('/reset-password', resetPassword);
router.post('/verification-token', getVerificationToken);

module.exports = router;
