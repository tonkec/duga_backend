const models = require('../../../models');
const User = models.User;
const ChatUser = models.ChatUser;
const Message = models.Message;
const { extractKeyFromUrl } = require('../../../utils/secureUploadUrl');
const { API_BASE_URL } = require("../../../consts/apiBaseUrl");

const handleGetAllMessages = async (req, res) => {
  const limit = 10;
  const page = Number(req.query.page) || 1;
  const chatId = Number(req.query.id);

  if (!chatId || isNaN(chatId)) {
    return res.status(400).json({ error: 'Invalid or missing chatId' });
  }

  const chatUser = await ChatUser.findOne({
    where: {
      chatId,
      userId: req.auth.user.id,
    },
  });

  if (!chatUser) {
    return res.status(403).json({ error: 'You do not have access to this chat' });
  }

  const offset = (page - 1) * limit;

  const messages = await Message.findAndCountAll({
    where: { chatId },
    include: [{ model: User }],
    limit,
    offset,
    order: [['id', 'DESC']],
  });

  // ✅ Add secureUrl for images
  const enrichedMessages = messages.rows.map((message) => {
    const plain = message.toJSON();
    const { messagePhotoUrl } = plain;
    if (message.type === "gif") {
      return message
    }

    if (messagePhotoUrl) {
      const key = extractKeyFromUrl(messagePhotoUrl);

      if (key) {
        plain.securePhotoUrl = `${API_BASE_URL}/uploads/files/${key}`;
      } else {
        console.warn('🚨 Could not extract key from:', messagePhotoUrl);
        plain.securePhotoUrl = null;
      }
    } else {
      plain.securePhotoUrl = null;
    }

    return plain;
  });


  const totalPages = Math.ceil(messages.count / limit);
  const result = {
    messages: enrichedMessages,
    pagination: { page, totalPages },
  };

  return res.status(200).json(result);
};

module.exports = handleGetAllMessages;