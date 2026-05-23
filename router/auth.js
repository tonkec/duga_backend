const router = require('express').Router();
const User = require("./../models").User
const withAccessCheck = require("../middleware/accessCheck");
const { authenticatedAppSession } = require('../middleware/authenticatedAppSession');
const handleRegister = require("./auth/handlers/handleRegister");
const handleSendVerificationEmail = require("./auth/handlers/handleSendVerificationEmail");
const handleDeleteUser = require("./auth/handlers/handleDeleteUser")
  
require('./auth/swagger/register.swagger');
router.post('/register', handleRegister);

require('./auth/swagger/verificationEmail.swagger');
router.post('/send-verification-email', withAccessCheck(User), handleSendVerificationEmail);

require('./auth/swagger/deleteUser.swagger');
router.delete('/delete-user', authenticatedAppSession, handleDeleteUser);
module.exports = router;