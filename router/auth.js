const router = require('express').Router();
const {
  register,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/authController');

const { validate } = require('../validators/index');
router.post('/register', [validate], register);
router.post('/send-verification-email', sendVerificationEmail);
module.exports = router;