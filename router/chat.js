
const ChatUser = require("./../models").ChatUser
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
const withAccessCheck = require("../middleware/accessCheck");
const attachCurrentUser = require('../middleware/attachCurrentUser');

router.get('/', [checkJwt, attachCurrentUser], index);
router.get("/current-chat/:id", [checkJwt, withAccessCheck(ChatUser)], getCurrentChat);
router.get('/messages', [checkJwt, attachCurrentUser], messages);
router.post('/create', [checkJwt, attachCurrentUser], create);
router.post('/add-user-to-group', checkJwt, addUserToGroup);
router.post('/leave-current-chat', checkJwt, leaveCurrentChat);
router.delete('/:id', [checkJwt], deleteChat);

module.exports = router;
