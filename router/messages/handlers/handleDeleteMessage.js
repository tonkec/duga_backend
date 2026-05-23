const { Message } = require('../../../models');

const handleDeleteMessage = async (req, res) => {
  try {
    const messageId = Number(req.params.id);

    if (!messageId) {
      return res.status(400).json({ error: 'Invalid or missing messageId' });
    }

    const message = await Message.findByPk(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const isOwner = message.fromUserId === req.auth.user.id;
    const isAdmin = req.currentUser?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await message.destroy();

    const io = req.app.get('io');
    if (io?.to) {
      io.to(`chat:${message.chatId}`).emit('messageDeleted', { id: messageId, chatId: message.chatId });
    } else if (io?.emit) {
      io.emit('messageDeleted', { id: messageId, chatId: message.chatId });
    }

    return res.status(200).json({ id: messageId });
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    return res.status(500).json({ error: 'Error occurred while deleting message' });
  }
};

module.exports = handleDeleteMessage;
