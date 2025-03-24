const router = require('express').Router();
const {
  register,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/authController');

router.post('/register', register);
router.post('/send-verification-email', sendVerificationEmail);
module.exports = router;