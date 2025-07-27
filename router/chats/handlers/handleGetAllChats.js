const { Chat } = require('../../../models');
const { User } = require('../../../models');
const { Message } = require('../../../models');
const { API_BASE_URL } = require("./../../../consts/apiBaseUrl");
const addSecureUrlsToList = require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const { Op } = require('sequelize');

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
              attributes: ['username', "id"],
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
              ],
              limit: 20,
              order: [['id', 'DESC']],
            },
          ],
        },
      ],
    });

    if (!result) return res.json([]);


    const chatsWithSecureUrls = result.Chats.map(chat => {
    const updatedMessages = addSecureUrlsToList(chat.Messages, API_BASE_URL, 'messagePhotoUrl');
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