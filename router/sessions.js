const router = require('express').Router();
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');
const handleStartSession = require('./sessions/handlers/handleStartSession');

router.post('/start', [checkJwt, attachCurrentUser], handleStartSession);

module.exports = router;
