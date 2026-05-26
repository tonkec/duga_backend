const models = require('../../../models');
const Chat = models.Chat;
const ChatUser = models.ChatUser;
const User = models.User;
const { Op } = require('sequelize');

const handleLeaveGroupChat = async (req, res) => {
  const chatId = Number(req.params.id);
  const userId = req.auth.user.id;
  let newAdminUserId = null;

  if (!chatId) {
    return res.status(400).json({ error: 'Invalid or missing chatId' });
  }

  try {
    const chat = await Chat.findOne({
      where: { id: chatId },
      include: [
        {
          model: User,
          attributes: ['id'],
        },
      ],
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.type !== 'group') {
      return res.status(400).json({ error: 'Only group chats can be left' });
    }

    const members = chat.Users || [];
    const membership = await ChatUser.findOne({
      where: {
        chatId,
        userId,
      },
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: 'You do not have access to this chat' });
    }

    if (membership.role === 'admin') {
      const nextAdmin = await ChatUser.findOne({
        where: {
          chatId,
          userId: {
            [Op.ne]: userId,
          },
        },
        order: [
          ['createdAt', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      if (nextAdmin) {
        await nextAdmin.update({ role: 'admin' });
        newAdminUserId = nextAdmin.userId;
      }
    }

    await ChatUser.destroy({
      where: {
        chatId,
        userId,
      },
    });

    const notifyUsers = members
      .map((user) => user.id)
      .filter((id) => Number(id) !== Number(userId));

    const io = req.app.get('io');
    if (io?.to) {
      io.to(`chat:${chatId}`).emit('remove-user-from-chat', {
        chatId,
        userId,
        currentUserId: userId,
        newAdminUserId,
      });
      io.in?.(`user:${userId}`)?.socketsLeave?.(`chat:${chatId}`);
    }

    return res.json({ chatId, userId, notifyUsers, newAdminUserId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleLeaveGroupChat;
