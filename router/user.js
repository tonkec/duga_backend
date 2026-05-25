const router = require('express').Router();
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const handleGetAllUsers = require('./users/handlers/handleGetAllUsers');
const handleGetUserByUsername = require('./users/handlers/handleGetUserByUsername');
const handleUpdateUser = require('./users/handlers/handleUpdateUser');
const handleGetUserById = require('./users/handlers/handleGetUserById');
const handleGetUserOnlineStatus = require('./users/handlers/handleGetUserOnlineStatus');
const handleGetCurrentUser = require('./users/handlers/handleGetCurrentUser');
const handlePostLogin = require('./users/handlers/handlePostLogin');

require('./users/swagger/updateUser.swagger');
router.post('/update-user', authenticatedAppSession, handleUpdateUser);

require('./users/swagger/allUsers.swagger');
router.get('/get-users', authenticatedAppSession, handleGetAllUsers);

require('./users/swagger/userUsername.swagger');
router.get(
  '/username/:username',
  authenticatedAppSession,
  handleGetUserByUsername
);

require('./users/swagger/userOnlineStatus.swagger');
router.get(
  '/online-status',
  authenticatedAppSession,
  handleGetUserOnlineStatus
);

require('./users/swagger/currentUser.swagger');
router.get('/current-user', authenticatedAppSession, handleGetCurrentUser);

require('./users/swagger/userById.swagger');
router.get('/:id', authenticatedAppSession, handleGetUserById);

require('./users/swagger/postLogin.swagger');
router.post('/post-login', authenticatedAppSession, handlePostLogin);

module.exports = router;
