const { ChatUser, Message } = require('../models');

const getChatIdFromKey = (key) => {
  const env = process.env.NODE_ENV || 'development';
  const prefix = `${env}/chat/`;
  if (!key.startsWith(prefix)) return null;

  const chatId = parseInt(key.split('/')[2], 10);
  return Number.isNaN(chatId) ? null : chatId;
};

const isChatMember = async (userId, chatId) => {
  const membership = await ChatUser.findOne({ where: { chatId, userId } });
  return !!membership;
};

const canAccessFileKey = async (userId, key) => {
  if (!userId || !key) return false;

  const chatIdFromPath = getChatIdFromKey(key);
  if (chatIdFromPath) {
    return isChatMember(userId, chatIdFromPath);
  }

  const message = await Message.findOne({ where: { messagePhotoUrl: key } });
  if (message) {
    return isChatMember(userId, message.chatId);
  }

  return true;
};

module.exports = canAccessFileKey;
