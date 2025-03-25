const router = require('express').Router();
const {
  update,
  getAllUsers,
  getUser,
} = require('../controllers/usersController');
const { checkJwt } = require('../middleware/auth');
router.post('/update-user', [checkJwt], update);
router.get('/get-users', checkJwt, getAllUsers);
router.get('/:id', checkJwt, getUser);
module.exports = router;
