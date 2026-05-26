const models = require('../../../models');
const User = models.User;
const ChatUser = models.ChatUser;
const Message = models.Message;
const MessageReaction = models.MessageReaction;
const {
  extractKeyFromUrl,
  attachSecureUrl,
} = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');

const summarizeMessageReactions = (reactions = [], userId) => {
  const counts = new Map();
  const userReactions = new Set();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;

    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    if (Number(reaction.userId) === Number(userId)) {
      userReactions.add(reaction.emoji);
    }
  });

  return {
    reactions: [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([emoji, count]) => ({ emoji, count })),
    reactionCount: reactions.length,
    userReactions: [...userReactions].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
};

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
    return res
      .status(403)
      .json({ error: 'You do not have access to this chat' });
  }

  const offset = (page - 1) * limit;

  const messages = await Message.findAndCountAll({
    where: { chatId },
    include: [
      { model: User },
      {
        model: MessageReaction,
        as: 'reactions',
        attributes: ['emoji', 'userId'],
      },
      {
        model: User,
        as: 'mentionedUsers',
        attributes: ['id', 'publicId', 'username', 'avatar'],
        through: { attributes: [] },
      },
    ],
    limit,
    offset,
    order: [['id', 'DESC']],
  });

  // ✅ Add secureUrl for images
  const accessToken = getBearerToken(req);
  const enrichedMessages = messages.rows.map((message) => {
    const plain = message.toJSON();
    Object.assign(
      plain,
      summarizeMessageReactions(plain.reactions, req.auth.user.id)
    );
    const { messagePhotoUrl } = plain;
    if (message.type === 'gif') {
      return message;
    }

    if (messagePhotoUrl) {
      const key = extractKeyFromUrl(messagePhotoUrl);

      if (key) {
        plain.securePhotoUrl = attachSecureUrl(API_BASE_URL, key, accessToken);
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
