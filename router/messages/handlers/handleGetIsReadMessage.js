const { MessageRead } = require('../../../models');

const handleGetIsReadMessage = async (req, res) => {
  try {
    const message = req.resource;
    const receipt = await MessageRead.findOne({
      where: {
        messageId: message.id,
        userId: req.auth.user.id,
      },
      attributes: ['readAt'],
    });

    return res.status(200).json({
      is_read: Boolean(receipt),
      readAt: receipt?.readAt || null,
    });
  } catch (error) {
    console.error('❌ Error checking message read status:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = handleGetIsReadMessage;
