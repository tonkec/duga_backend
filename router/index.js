const router = require('express').Router();
router.get('/home', (req, res) => {
  return res.send('Home');
});

router.use('/', require('./auth'));
router.use('/users', require('./user'));
router.use('/chats', require('./chat'));
router.use('/uploads', require('./uploads'));

module.exports = router;
