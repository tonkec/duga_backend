const ChatUser = require('./../../../models').ChatUser;
const { Chat } = require('./../../../models');
const { User } = require('./../../../models');
const { sequelize } = require('./../../../models');

const handleCreateMessage = async (req, res) => {
  const { partnerId } = req.body;
  const id = req.auth.user.id;
  let t;

  if (!partnerId || typeof partnerId !== 'number') {
    return res.status(400).json({ error: 'Invalid or missing partnerId' });
  }

  if (partnerId === id) {
    return res
      .status(400)
      .json({ error: 'Cannot create a chat with yourself' });
  }

  const partner = await User.findByPk(partnerId);
  if (!partner) {
    return res.status(404).json({ error: 'Partner not found' });
  }

  try {
    const user = await User.findOne({
      where: { id },
      include: [
        {
          model: Chat,
          where: { type: 'dual' },
          include: [
            {
              model: ChatUser,
              where: { userId: partnerId },
            },
          ],
        },
      ],
    });

    if (user && user.Chats.length > 0) {
      return res.status(200).json(user.Chats[0]);
    }

    t = await sequelize.transaction();

    const chat = await Chat.create({ type: 'dual' }, { transaction: t });

    await ChatUser.bulkCreate(
      [
        { chatId: chat.id, userId: id },
        { chatId: chat.id, userId: partnerId },
      ],
      { transaction: t }
    );

    await t.commit();

    const creator = await User.findByPk(id);

    const safePartner = {
      id: partner.id,
      username: partner.username,
      avatar: partner.avatar,
    };

    const safeCreator = {
      id: creator.id,
      username: creator.username,
      avatar: creator.avatar,
    };

    const forCreator = {
      id: chat.id,
      type: 'dual',
      Users: [safePartner],
      Messages: [],
    };

    const forReceiver = {
      id: chat.id,
      type: 'dual',
      Users: [safeCreator],
      Messages: [],
    };

    return res.json([forCreator, forReceiver]);
  } catch (e) {
    if (t) {
      await t.rollback();
    }
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleCreateMessage;
