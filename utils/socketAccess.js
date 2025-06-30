const { User } = require('../models');

const socketCanAccess = async ({ socket, model, resourceId }) => {
  try {
    const auth0Id = socket.user?.sub;
    if (!auth0Id) return false;

    const user = await User.findOne({ where: { auth0Id } });
    if (!user) return false;

    const resource = await model.findByPk(resourceId);
    if (!resource) return false;

    if ('userId' in resource && resource.userId === user.id) return true;
    // if (user.role === 'admin') return true;

    return false;
  } catch (err) {
    console.error('❌ Error in socketCanAccess:', err);
    return false;
  }
};

module.exports = socketCanAccess;
