const Message = require('../models').Message;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const withAccessCheck = require('../middleware/accessCheck');   
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { Chat, ChatUser } = require('../models');

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

// Secure route
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