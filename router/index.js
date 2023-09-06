const router = require('express').Router();

router.use('/', require('./auth'));
router.use('/users', require('./user'));
router.use('/chats', require('./chat'));
router.use('/uploads', require('./uploads'));
router.use('/likes', require('./photolikes'));

module.exports = router;
