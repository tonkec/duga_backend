
const ChatUser = require("./../models").ChatUser
const router = require('express').Router();
const { Chat } = require('../models');
const { checkJwt } = require('../middleware/auth');
const withAccessCheck = require("../middleware/accessCheck");
const attachCurrentUser = require('../middleware/attachCurrentUser');
const handleGetAllChats = require("./chats/handlers/handleGetAllChats");
const handleGetCurrentChat = require("./chats/handlers/handleGetCurrentChat");
const handleGetAllMessages = require("./chats/handlers/handleGetAllMessages");
const handleCreateMessage = require("./chats/handlers/handleCreateMessage");
const handleDeleteChat = require("./chats/handlers/handleDeleteChat")

require('./chats/swagger/allChats.swagger');
router.get('/', [checkJwt, attachCurrentUser], handleGetAllChats);

require('./chats/swagger/currentChat.swagger');
router.get('/current-chat/:id', [checkJwt, withAccessCheck(ChatUser)], handleGetCurrentChat);

require('./chats/swagger/chatMessages.swagger');
router.get('/messages', [checkJwt, attachCurrentUser], handleGetAllMessages);

require('./chats/swagger/createMessage.swagger');
router.post('/create', [checkJwt, attachCurrentUser], handleCreateMessage);

require('./chats/swagger/deleteChat.swagger');
router.delete('/:id', [checkJwt, withAccessCheck(Chat)], handleDeleteChat);

module.exports = router;
