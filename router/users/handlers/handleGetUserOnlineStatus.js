const User = require('../../../models').User;

const handleGetUserOnlineStatus = async (req, res) => {
  try {
    const userId = req.auth.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID parameter' });
    }

    const user = await User.findByPk(userId, {
      attributes: ['status'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ status: user.status });
  } catch (e) {
    console.log(e)
    return res.status(500).json({ error: e.message });
  }
}

module.exports = handleGetUserOnlineStatus;