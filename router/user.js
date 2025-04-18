const router = require('express').Router();
const {
  update,
  getAllUsers,
  getUser,
  getUsersByUsername,
  getUserOnlineStatus,
} = require('../controllers/usersController');
const { checkJwt } = require('../middleware/auth');
router.post('/update-user', [checkJwt], update);
router.get('/get-users', checkJwt, getAllUsers);
router.get('/username/:username', checkJwt, getUsersByUsername); 
router.get('/:id', checkJwt, getUser);
router.get("/online-status/:id/", checkJwt, getUserOnlineStatus);
module.exports = router;
