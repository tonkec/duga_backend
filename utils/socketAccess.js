const { User } = require('../models');
const canAccess = require('./canAccess');

const getSocketUser = async (socket) => {
  const auth0Id = socket.user?.sub;
  if (!auth0Id) return null;
  return User.findOne({ where: { auth0Id } });
};

const socketCanAccess = async ({ socket, model, resourceId }) => {
  try {
    const user = await getSocketUser(socket);
    if (!user) return false;

    const resource = await model.findByPk(resourceId);
    if (!resource) return false;

    return canAccess(user, resource);
  } catch (err) {
    console.error('❌ Error in socketCanAccess:', err);
    return false;
  }
};

module.exports = socketCanAccess;
module.exports.getSocketUser = getSocketUser;
