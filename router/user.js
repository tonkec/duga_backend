const router = require('express').Router();
const {
  update,
  search,
  getAllUsers,
  getUser,
} = require('../controllers/usersController');
const { auth } = require('../middleware/auth');
const { userFile } = require('../middleware/fileUpload');
const { validate } = require('../validators/index');
const { rules: updateRules } = require('../validators/user/update');
router.post('/update', [auth, userFile, updateRules(), validate], update);
router.get('/search-users', auth, search);
router.get('/get-users', auth, getAllUsers);
router.get('/:id', auth, getUser);
module.exports = router;
