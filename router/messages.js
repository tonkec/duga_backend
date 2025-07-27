const Message = require('../models').Message;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const withAccessCheck = require('../middleware/accessCheck');   
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { Chat, ChatUser } = require('../models');
const handleReadMessage = require('./messages/handlers/handleReadMessage');
const handleGetIsReadMessage = require('./messages/handlers/handleGetIsReadMessage');

require('./messages/swagger/readMessage.swagger');
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
            include: [{ model: ChatUser }],
          },
        ],
      });
    }),
  ],
  handleReadMessage
);

<<<<<<< HEAD
require('./messages/swagger/isReadMessage.swagger');
=======
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
>>>>>>> master
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
  handleGetIsReadMessage
);


module.exports = router;