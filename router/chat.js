
const ChatUser = require("./../models").ChatUser
const router = require('express').Router();
const { Chat } = require('../models');
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


/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: Chat management and messaging
 */

/**
 * @swagger
 * /chats:
 *   get:
 *     summary: Get all chats for current user
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of chats
 */
router.get('/', [checkJwt, attachCurrentUser], index);

/**
 * @swagger
 * /chats/current-chat/{id}:
 *   get:
 *     summary: Get a specific chat with its messages and members
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Chat ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat details
 *       403:
 *         description: Forbidden or access denied
 */
router.get('/current-chat/:id', [checkJwt, withAccessCheck(ChatUser)], getCurrentChat);

/**
 * @swagger
 * /chats/messages:
 *   get:
 *     summary: Get recent messages for the current user's chats
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of recent messages
 */
router.get('/messages', [checkJwt, attachCurrentUser], messages);

/**
 * @swagger
 * /chats/create:
 *   post:
 *     summary: Create a new chat (direct or group)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: number
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat created successfully
 */
router.post('/create', [checkJwt, attachCurrentUser], create);

/**
 * @swagger
 * /chats/add-user-to-group:
 *   post:
 *     summary: Add a user to an existing group chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: number
 *               userId:
 *                 type: number
 *     responses:
 *       200:
 *         description: User added to chat
 */
router.post('/add-user-to-group', checkJwt, addUserToGroup);

/**
 * @swagger
 * /chats/leave-current-chat:
 *   post:
 *     summary: Leave the current group chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Left the chat
 */
router.post('/leave-current-chat', checkJwt, leaveCurrentChat);

/**
 * @swagger
 * /chats/{id}:
 *   delete:
 *     summary: Delete a chat (admin or owner only)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 *       403:
 *         description: Forbidden
 */
router.delete('/:id', [checkJwt, withAccessCheck(Chat)], deleteChat);

module.exports = router;
