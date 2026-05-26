const { Chat } = require('../../../models');
const { User } = require('../../../models');
const { Message } = require('../../../models');
const { MessageReaction } = require('../../../models');
const { API_BASE_URL } = require('./../../../consts/apiBaseUrl');
const addSecureUrlsToList =
  require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const getBearerToken = require('../../../utils/getBearerToken');
const { Op } = require('sequelize');

const summarizeMessageReactions = (reactions = [], userId) => {
  const counts = new Map();
  const userReactions = new Set();

  reactions.forEach((reaction) => {
    const plain = reaction?.toJSON?.() || reaction;
    if (!plain?.emoji) return;

    counts.set(plain.emoji, (counts.get(plain.emoji) || 0) + 1);
    if (Number(plain.userId) === Number(userId)) {
      userReactions.add(plain.emoji);
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

const handleGetAllChats = async (req, res) => {
  const user = req.auth?.user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  try {
    const result = await User.findOne({
      where: { id: user.id },
      include: [
        {
          model: Chat,
          include: [
            {
              model: User,
              attributes: ['username', 'id'],
              where: {
                [Op.not]: { id: user.id },
              },
            },
            {
              model: Message,
              include: [
                {
                  model: User,
                  attributes: ['id', 'username', 'avatar'],
                },
                {
                  model: MessageReaction,
                  as: 'reactions',
                  attributes: ['emoji', 'userId'],
                },
              ],
              limit: 20,
              order: [['id', 'DESC']],
            },
          ],
        },
      ],
    });

    if (!result) return res.json([]);

    const accessToken = getBearerToken(req);
    const chatsWithSecureUrls = result.Chats.map((chat) => {
      const updatedMessages = addSecureUrlsToList(
        chat.Messages,
        API_BASE_URL,
        'messagePhotoUrl',
        'securePhotoUrl',
        accessToken
      ).map((message) => ({
        ...message,
        ...summarizeMessageReactions(message.reactions, user.id),
      }));
      return {
        ...chat.toJSON(),
        Messages: updatedMessages,
      };
    });

    return res.json(chatsWithSecureUrls);
  } catch (err) {
    console.error('Error fetching chats:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = handleGetAllChats;
