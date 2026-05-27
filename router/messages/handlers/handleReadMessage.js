const { MessageRead } = require('../../../models');

const handleReadMessage = async (req, res) => {
  try {
    const message = req.resource;
    const userId = req.auth.user.id;
    const readAt = new Date();

    const [receipt] = await MessageRead.upsert(
      {
        messageId: message.id,
        userId,
        readAt,
      },
      {
        returning: true,
      }
    );

    return res.status(200).send({
      messageId: message.id,
      userId,
      readAt: receipt?.readAt || readAt,
      is_read: true,
    });
  } catch (error) {
    console.error('❌ Error reading message:', error);
    return res.status(500).send({
      message: 'Error occurred while reading message',
    });
  }
};

module.exports = handleReadMessage;
