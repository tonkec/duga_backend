const router = require('express').Router();
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');
const handleGetAllUsers = require('./users/handlers/handleGetAllUsers');
const handleGetUserByUsername = require('./users/handlers/handleGetUserByUsername');
const handleUpdateUser = require('./users/handlers/handleUpdateUser');
const handleGetUserById = require("./users/handlers/handleGetUserById");
const handleGetUserOnlineStatus = require('./users/handlers/handleGetUserOnlineStatus');
const handleGetCurrentUser = require('./users/handlers/handleGetCurrentUser');
const handleGetUsersByUsername = require("./users/handlers/handleGetUsersByUsername");

require('./users/swagger/updateUser.swagger');
router.post('/update-user', [checkJwt, attachCurrentUser], handleUpdateUser);

require('./users/swagger/allUsers.swagger');
router.get('/get-users', [checkJwt, attachCurrentUser], handleGetAllUsers);

require('./users/swagger/userUsername.swagger');
router.get('/username/:username', [checkJwt, attachCurrentUser], handleGetUserByUsername);

require('./users/swagger/userOnlineStatus.swagger');
router.get('/online-status', [checkJwt, attachCurrentUser], handleGetUserOnlineStatus);

require('./users/swagger/currentUser.swagger');
router.get('/current-user', [checkJwt, attachCurrentUser], handleGetCurrentUser);

require('./users/swagger/userById.swagger');
router.get('/:id', [checkJwt], handleGetUserById);

require('./users/swagger/usersByUsername.swagger');
router.post('/by-usernames', [checkJwt], handleGetUsersByUsername);

module.exports = router;
