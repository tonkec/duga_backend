const ChatUser = require("../models").ChatUser

const canAccess = async (user, resource) => {
  if (!user || !resource) return false;

  if ('auth0Id' in resource && resource.auth0Id === user.auth0Id) return true;
  if ('userId' in resource && resource.userId === user.id) return true;
  if ('fromUserId' in resource && resource.fromUserId === user.id) return true;

  if ('chatId' in resource) {
    const chatUsers = await ChatUser.findAll({
      where: { chatId: resource.chatId },
      attributes: ['userId'],
    });

    return chatUsers.some((u) => u.userId === user.id);
  }

  return user.role === 'admin';
};

module.exports = canAccess;