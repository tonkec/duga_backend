const ChatUser = require('./../../../models').ChatUser;
const { Chat } = require('./../../../models');
const { User } = require('./../../../models');
const { sequelize } = require('./../../../models');
const { Op } = require('sequelize');

const MAX_GROUP_MEMBERS = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const buildSafeUser = (user) => ({
  id: user.id,
  publicId: user.publicId,
  username: user.username,
  avatar: user.avatar,
});

const handleCreateGroupChat = async (req, res) => {
  const { userIds, userPublicIds, name } = req.body;
  const id = req.auth.user.id;
  let t;

  if (!Array.isArray(userIds) && !Array.isArray(userPublicIds)) {
    return res.status(400).json({ error: 'Invalid or missing userIds' });
  }

  if (
    Array.isArray(userPublicIds) &&
    userPublicIds.some((publicId) => !UUID_PATTERN.test(String(publicId)))
  ) {
    return res.status(400).json({ error: 'Invalid userPublicIds' });
  }

  const memberIds = [
    ...new Set((userIds || []).map((userId) => Number(userId))),
  ].filter((userId) => userId !== id);
  const uniqueUserPublicIds = [...new Set(userPublicIds || [])];

  if (memberIds.some((userId) => !Number.isInteger(userId) || userId <= 0)) {
    return res.status(400).json({
      error: 'Group chats require at least two valid userIds',
    });
  }

  if (memberIds.length + uniqueUserPublicIds.length < 2) {
    return res.status(400).json({
      error: 'Group chats require at least two valid userIds',
    });
  }

  if (memberIds.length + 1 > MAX_GROUP_MEMBERS) {
    return res.status(400).json({
      error: `Group chats can have up to ${MAX_GROUP_MEMBERS} members`,
    });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : null;

  try {
    const usersByPublicId =
      uniqueUserPublicIds.length > 0
        ? await User.findAll({
            where: {
              publicId: {
                [Op.in]: uniqueUserPublicIds,
              },
            },
          })
        : [];
    const publicMemberIds = usersByPublicId
      .map((user) => user.id)
      .filter((userId) => userId !== id);
    const allMemberIds = [...new Set([...memberIds, ...publicMemberIds])];

    if (allMemberIds.length < 2) {
      return res.status(400).json({
        error: 'Group chats require at least two valid userIds',
      });
    }

    if (usersByPublicId.length !== uniqueUserPublicIds.length) {
      return res.status(404).json({ error: 'One or more users not found' });
    }

    if (allMemberIds.length + 1 > MAX_GROUP_MEMBERS) {
      return res.status(400).json({
        error: `Group chats can have up to ${MAX_GROUP_MEMBERS} members`,
      });
    }

    const users = await User.findAll({
      where: {
        id: {
          [Op.in]: allMemberIds,
        },
      },
    });

    if (users.length !== allMemberIds.length) {
      return res.status(404).json({ error: 'One or more users not found' });
    }

    t = await sequelize.transaction();

    const chat = await Chat.create(
      { type: 'group', name: trimmedName || null },
      { transaction: t }
    );

    await ChatUser.bulkCreate(
      [
        { chatId: chat.id, userId: id, role: 'admin' },
        ...allMemberIds.map((userId) => ({
          chatId: chat.id,
          userId,
          role: 'member',
        })),
      ],
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      id: chat.id,
      type: 'group',
      name: chat.name,
      Users: users.map(buildSafeUser),
      Messages: [],
    });
  } catch (e) {
    if (t) {
      await t.rollback();
    }
    return res.status(500).json({ error: e.message });
  }
};

const handleCreateMessage = async (req, res) => {
  const { partnerId, partnerPublicId } = req.body;
  const id = req.auth.user.id;
  let t;

  if (
    Array.isArray(req.body.userIds) ||
    Array.isArray(req.body.userPublicIds)
  ) {
    return handleCreateGroupChat(req, res);
  }

  if (!partnerId && !partnerPublicId) {
    return res.status(400).json({ error: 'Invalid or missing partnerId' });
  }

  if (partnerPublicId && !UUID_PATTERN.test(String(partnerPublicId))) {
    return res.status(400).json({ error: 'Invalid partnerPublicId' });
  }

  const partner = partnerPublicId
    ? await User.findOne({ where: { publicId: partnerPublicId } })
    : await User.findByPk(partnerId);

  if (!partner) {
    return res.status(404).json({ error: 'Partner not found' });
  }

  if (partner.id === id) {
    return res
      .status(400)
      .json({ error: 'Cannot create a chat with yourself' });
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
              where: { userId: partner.id },
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
        { chatId: chat.id, userId: partner.id },
      ],
      { transaction: t }
    );

    await t.commit();

    const creator = await User.findByPk(id);

    const safePartner = buildSafeUser(partner);

    const safeCreator = buildSafeUser(creator);

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
