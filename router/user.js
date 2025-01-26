const router = require('express').Router();
const {
  update,
  search,
  getAllUsers,
  getUser,
} = require('../controllers/usersController');
const { checkJwt } = require('../middleware/auth');
const { userFile } = require('../middleware/fileUpload');
const { validate } = require('../validators/index');
router.post('/update-user', [checkJwt, userFile, validate], update);
router.get('/search-users', checkJwt, search);
router.get('/get-users', checkJwt, getAllUsers);
router.get('/:id', checkJwt, getUser);
module.exports = router;
