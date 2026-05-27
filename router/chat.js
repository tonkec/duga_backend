const ChatUser = require('./../models').ChatUser;
const router = require('express').Router();
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const handleGetAllChats = require('./chats/handlers/handleGetAllChats');
const handleGetCurrentChat = require('./chats/handlers/handleGetCurrentChat');
const handleGetAllMessages = require('./chats/handlers/handleGetAllMessages');
const handleCreateMessage = require('./chats/handlers/handleCreateMessage');
const handleDeleteChat = require('./chats/handlers/handleDeleteChat');
const handleLeaveGroupChat = require('./chats/handlers/handleLeaveGroupChat');

require('./chats/swagger/allChats.swagger');
router.get('/', authenticatedAppSession, handleGetAllChats);

require('./chats/swagger/currentChat.swagger');
router.get(
  '/current-chat/:id',
  [
    ...authenticatedAppSession,
    withAccessCheck(ChatUser, async (req) => {
      const chatId = Number(req.params.id);
      if (!chatId) return null;

      return ChatUser.findOne({
        where: {
          chatId,
          userId: req.auth.user.id,
        },
      });
    }),
  ],
  handleGetCurrentChat
);

require('./chats/swagger/chatMessages.swagger');
router.get('/messages', authenticatedAppSession, handleGetAllMessages);

require('./chats/swagger/createMessage.swagger');
router.post('/create', authenticatedAppSession, handleCreateMessage);

require('./chats/swagger/leaveGroupChat.swagger');
router.post('/:id/leave', authenticatedAppSession, handleLeaveGroupChat);

require('./chats/swagger/deleteChat.swagger');
router.delete('/:id', authenticatedAppSession, handleDeleteChat);

module.exports = router;
