const models = require('../models');
const User = models.User;
const Chat = models.Chat;
const ChatUser = models.ChatUser;
const Message = models.Message;
const { Op } = require('sequelize');
const { sequelize } = require('../models');

exports.getCurrentChat = async (req, res) => {
  const { id } = req.params;

  const chatUsers = await ChatUser.findAll({
    where: {
      chatId: id,
    },
  });

  if (!chatUsers) {
    return res.status(404).json({
      status: 'Error',
      message: 'Chat not found!',
    });
  }
  
  return res.json(chatUsers);
};

exports.index = async (req, res) => {
  const userId =  req.auth.user.id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const user = await User.findOne({
    where: {
      id: userId
    },
    include: [
      {
        model: Chat,
        include: [
          {
            model: User,
            where: {
              [Op.not]: {
                id: userId
              },
            },
          },
          {
            model: Message,
            include: [{ model: User }],
            limit: 20,
            order: [['id', 'DESC']],
          },
        ],
      },
    ],
  });

  if (user) {
    return res.json(user.Chats);
  }

  return res.json([]);
};

exports.create = async (req, res) => {
  const { partnerId } = req.body;
  const id = req.auth.user.id;

  const t = await sequelize.transaction();

  try {
    const user = await User.findOne({
      where: {
        id: id
      },
      include: [
        {
          model: Chat,
          where: {
            type: 'dual',
          },
          include: [
            {
              model: ChatUser,
              where: {
                userId: partnerId,
              },
            },
          ],
        },
      ],
    });

    if (user && user.Chats.length > 0)
      return res.status(403).json({
        status: 'Error',
        message: 'Chat with this user already exists!',
      });

    const chat = await Chat.create({ type: 'dual' }, { transaction: t });

    await ChatUser.bulkCreate(
      [
        {
          chatId: chat.id,
          userId: id
        },
        {
          chatId: chat.id,
          userId: partnerId,
        },
      ],
      { transaction: t }
    );

    await t.commit();

    const creator = await User.findOne({
      where: {
        id: id
      },
    });

    const partner = await User.findOne({
      where: {
        id: partnerId,
      },
    });

    const forCreator = {
      id: chat.id,
      type: 'dual',
      Users: [partner],
      Messages: [],
    };

    const forReceiver = {
      id: chat.id,
      type: 'dual',
      Users: [creator],
      Messages: [],
    };

    return res.json([forCreator, forReceiver]);
  } catch (e) {
    await t.rollback();
    return res.status(500).json({ status: 'Error', message: e.message });
  }
};

exports.messages = async (req, res) => {
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

  const totalPages = Math.ceil(messages.count / limit);
  const result = {
    messages: messages.rows,
    pagination: { page, totalPages },
  };

  return res.status(200).json(result);
};

exports.deleteChat = async (req, res) => {
  try {
    await Chat.destroy({
      where: {
        id: req.params.id,
      },
    });

    return res.json({
      status: 'Success',
      messages: 'Chat deleted successfully',
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
};

exports.addUserToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      include: [
        {
          model: User,
        },
        {
          model: Message,
          include: [
            {
              model: User,
            },
          ],
          limit: 20,
          order: [['id', 'DESC']],
        },
      ],
    });

    chat.Messages.reverse();

    // check if already in the group
    chat.Users.forEach((user) => {
      if (user.id === userId) {
        return res.status(403).json({ message: 'User already in the group!' });
      }
    });

    await ChatUser.create({ chatId, userId });

    const newChatter = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (chat.type === 'dual') {
      chat.type = 'group';
      chat.save();
    }

    return res.json({ chat, newChatter });
  } catch (e) {
    return res.status(500).json({ status: 'Error', message: e.message });
  }
};

exports.leaveCurrentChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    const chat = await Chat.findOne({
      where: {
        id: chatId,
      },
      include: [
        {
          model: User,
        },
      ],
    });

    if (chat.Users.length === 2) {
      return res
        .status(403)
        .json({ status: 'Error', message: 'You cannot leave this chat' });
    }

    if (chat.Users.length === 3) {
      chat.type = 'dual';
      chat.save();
    }

    await ChatUser.destroy({
      where: {
        chatId,
        userId: req.user.id,
      },
    });

    await Message.destroy({
      where: {
        chatId,
        fromUserId: req.user.id,
      },
    });

    const notifyUsers = chat.Users.map((user) => user.id);

    return res.json({
      chatId: chat.id,
      userId: req.user.id,
      currentUserId: req.user.id,
      notifyUsers,
    });
  } catch (e) {
    return res.status(500).json({ status: 'Error', message: e.message });
  }
};

exports.deleteChat = async (req, res) => {
  const { id } = req.params;

  try {
    const chat = await Chat.findOne({
      where: {
        id,
      },
      include: [
        {
          model: User,
        },
      ],
    });

    const notifyUsers = chat.Users.map((user) => user.id);

    await chat.destroy();
    return res.json({ chatId: id, notifyUsers });
  } catch (e) {
    return res.status(500).json({ status: 'Error', message: e.message });
  }
};
