const router = require('express').Router();
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const { checkJwt } = require('../middleware/auth');
const handleRegister = require('./auth/handlers/handleRegister');
const handleSendVerificationEmail = require('./auth/handlers/handleSendVerificationEmail');
const handleDeleteUser = require('./auth/handlers/handleDeleteUser');

require('./auth/swagger/register.swagger');
router.post('/register', checkJwt, handleRegister);

require('./auth/swagger/verificationEmail.swagger');
router.post('/send-verification-email', checkJwt, handleSendVerificationEmail);

require('./auth/swagger/deleteUser.swagger');
router.delete('/delete-user', authenticatedAppSession, handleDeleteUser);
module.exports = router;
