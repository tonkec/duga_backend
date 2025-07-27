const User = require('../../../models').User;

const handleGetCurrentUser = async (req, res) => {
  try {
    const userId = req.auth.user.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['auth0Id'] },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
    }
}

module.exports = handleGetCurrentUser;