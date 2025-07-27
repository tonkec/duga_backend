const models = require('../../../models');
const ChatUser = models.ChatUser;

const getCurrentChat = async (req, res) => {
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

module.exports = getCurrentChat;