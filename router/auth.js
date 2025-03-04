const router = require('express').Router();
const {
  register,
} = require('../controllers/authController');

const { validate } = require('../validators/index');
router.post('/register', [ validate], register);
module.exports = router;