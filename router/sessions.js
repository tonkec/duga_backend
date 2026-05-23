const router = require('express').Router();
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');
const { authenticatedAppSession } = require('../middleware/authenticatedAppSession');
const handleLogoutSession = require('./sessions/handlers/handleLogoutSession');
const handleStartSession = require('./sessions/handlers/handleStartSession');

router.post('/start', [checkJwt, attachCurrentUser], handleStartSession);
router.post('/logout', authenticatedAppSession, handleLogoutSession);

module.exports = router;
