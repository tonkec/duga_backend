const Message = require('../models').Message;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const withAccessCheck = require('../middleware/accessCheck');   
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { Chat, ChatUser } = require('../models');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Message read status and tracking
 */

/**
 * @swagger
 * /messages/read-message:
 *   post:
 *     summary: Mark a message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: number
 *                 description: ID of the message to mark as read
 *     responses:
 *       200:
 *         description: Message marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       403:
 *         description: Forbidden or invalid message access
 *       500:
 *         description: Server error
 */
router.post(
  '/read-message',
  [
    checkJwt,
    withAccessCheck(Message, async (req) => {
      const messageId = Number(req.body.id);
      if (!messageId) return null;

      return await Message.findOne({
        where: { id: messageId },
        include: [
          {
            model: Chat,
            include: [
              {
                model: ChatUser,
              },
            ],
          },
        ],
      });
    }),
  ],
  async (req, res) => {
    try {
      const message = req.resource; 

      message.is_read = true;
      await message.save();

      return res.status(200).send(message);
    } catch (error) {
      console.error(error);
      return res.status(500).send({
        message: 'Error occurred while reading message',
      });
    }
  }
);

/**
 * @swagger
 * /messages/is-read:
 *   get:
 *     summary: Check if a message is read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID of the message to check
 *     responses:
 *       200:
 *         description: Message read status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 is_read:
 *                   type: boolean
 *       403:
 *         description: Forbidden or unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/is-read",
  [
    checkJwt,
    attachCurrentUser,
    withAccessCheck(Message, async (req) => {
      const messageId = Number(req.query.id);
      if (!messageId) return null;

      return await Message.findOne({
        where: { id: messageId },
        include: {
          model: Chat,
          include: {
            model: ChatUser,
            where: {
              userId: req.auth.user.id, 
            },
          },
        },
      });
    }),
  ],
  async (req, res) => {
    try {
      const message = req.resource;

      return res.status(200).json({ is_read: message.is_read });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;