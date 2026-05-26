const models = require('../../../models');
const Chat = models.Chat;
const ChatUser = models.ChatUser;
const User = models.User;

const handleDeleteChat = async (req, res) => {
  const chatId = Number(req.params.id);
  const userId = req.auth.user.id;

  if (!chatId) {
    return res.status(400).json({ error: 'Invalid or missing chatId' });
  }

  try {
    const chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      include: [
        {
          model: User,
        },
      ],
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

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

    if (chat.type === 'group' && membership.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Only group admins can delete group chats' });
    }

    const notifyUsers = chat.Users.map((user) => user.id);

    await chat.destroy();
    return res.json({ chatId, notifyUsers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleDeleteChat;
