const router = require('express').Router();
const User = require("./../models").User
const {
  register,
  deleteUser,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/authController');
const withAccessCheck = require("../middleware/accessCheck");
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');

router.post('/register', register);
router.post('/send-verification-email', withAccessCheck(User), sendVerificationEmail);
router.delete('/delete-user', [checkJwt, attachCurrentUser], deleteUser);
module.exports = router;