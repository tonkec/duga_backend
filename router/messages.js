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

require('./messages/swagger/isReadMessage.swagger');
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