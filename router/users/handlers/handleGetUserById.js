const User = require('../../../models').User;

const handleGetUserById = async (req, res) => {
  try {

    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['auth0Id'] },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetUserById;