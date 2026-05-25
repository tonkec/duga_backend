const { ChatUser, Message, Notification } = require('../../../models');

const handleCreateMessage = async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { chatId, message, type = 'text', messagePhotoUrl = null } = req.body;
    const parsedChatId = Number(chatId);

    if (!parsedChatId) {
      return res.status(400).json({ error: 'Invalid or missing chatId' });
    }

    if (
      (!message ||
        typeof message !== 'string' ||
        message.trim().length === 0) &&
      !messagePhotoUrl
    ) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const chatUser = await ChatUser.findOne({
      where: {
        chatId: parsedChatId,
        userId,
      },
    });

    if (!chatUser) {
      return res
        .status(403)
        .json({ error: 'You do not have access to this chat' });
    }

    const savedMessage = await Message.create({
      chatId: parsedChatId,
      fromUserId: userId,
      type,
      message: message || null,
      messagePhotoUrl,
    });

    const chatMembers = await ChatUser.findAll({
      where: { chatId: parsedChatId },
      attributes: ['userId'],
    });

    const io = req.app.get('io');
    await Promise.all(
      chatMembers
        .filter((member) => member.userId !== userId)
        .map(async (member) => {
          const notification = await Notification.create({
            userId: member.userId,
            type: 'message',
            content: 'Nova poruka.',
            actionId: savedMessage.id,
            actionType: 'message',
            chatId: parsedChatId,
          });

          if (io?.to) {
            io.to(`user:${member.userId}`).emit(
              'new_notification',
              notification
            );
          }
        })
    );

    if (io?.to) {
      io.to(`chat:${parsedChatId}`).emit('received', savedMessage);
    } else if (io?.emit) {
      io.emit('received', savedMessage);
    }

    return res.status(201).json({ data: savedMessage });
  } catch (error) {
    console.error('❌ Error creating message:', error);
    return res
      .status(500)
      .json({ error: 'Error occurred while creating message' });
  }
};

module.exports = handleCreateMessage;
