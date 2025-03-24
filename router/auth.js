const router = require('express').Router();
const {
  register,
  deleteUser,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/authController');

router.post('/register', register);
router.post('/send-verification-email', sendVerificationEmail);
router.delete('/delete-user', deleteUser);
module.exports = router;