const router = require('express').Router();
const {
  index,
  create,
  messages,
  deleteChat,
  addUserToGroup,
  leaveCurrentChat,
  getCurrentChat,
} = require('../controllers/chatController');
const { checkJwt } = require('../middleware/auth');

router.get('/', [checkJwt], index);
router.get("/current-chat/:id", [checkJwt], getCurrentChat);
router.get('/messages', [checkJwt], messages);
router.post('/create', [checkJwt], create);
router.post('/add-user-to-group', checkJwt, addUserToGroup);
router.post('/leave-current-chat', checkJwt, leaveCurrentChat);
router.delete('/:id', [checkJwt], deleteChat);

module.exports = router;
