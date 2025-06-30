const router = require('express').Router();
const {
  update,
  getAllUsers,
  getUser,
  getUsersByUsername,
  getUserOnlineStatus,
} = require('../controllers/usersController');
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');

router.post('/update-user', [checkJwt, attachCurrentUser], update);
router.get('/get-users', [checkJwt, attachCurrentUser], getAllUsers);
router.get('/username/:username', [checkJwt, attachCurrentUser], getUsersByUsername); 
router.get("/online-status/", [checkJwt, attachCurrentUser], getUserOnlineStatus);
router.get('/:id', [checkJwt], getUser);
module.exports = router;
