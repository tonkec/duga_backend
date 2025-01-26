const router = require('express').Router();
const {
  index,
  create,
  messages,
  deleteChat,
  imageUpload,
  addUserToGroup,
  leaveCurrentChat,
  getCurrentChat,
} = require('../controllers/chatController');
const { checkJwt } = require('../middleware/auth');
const { chatFile } = require('../middleware/fileUpload');

router.get('/', [checkJwt], index);
router.get("/current-chat/:id", [checkJwt], getCurrentChat);
router.get('/messages', [checkJwt], messages);
router.post('/create', [checkJwt], create);
router.post('/upload-image', [checkJwt, chatFile], imageUpload);
router.post('/add-user-to-group', checkJwt, addUserToGroup);
router.post('/leave-current-chat', checkJwt, leaveCurrentChat);
router.delete('/:id', [checkJwt], deleteChat);

module.exports = router;
