const router = require('express').Router();
const {
  update,
  getAllUsers,
  getUser,
  getUsersByUsername
} = require('../controllers/usersController');
const { checkJwt } = require('../middleware/auth');
router.post('/update-user', [checkJwt], update);
router.get('/get-users', checkJwt, getAllUsers);
router.get('/username/:username', checkJwt, getUsersByUsername); 
router.get('/:id', checkJwt, getUser);
router.get("/online-status/:id/", checkJwt, getUser);
module.exports = router;
