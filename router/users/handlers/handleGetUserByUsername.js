const User = require('../../../models').User;

const handleGetUserByUsername = async (req, res) => {
  try {
    const username = req.params.username;

    if (!username) {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    const users = await User.findAll({
      where: {
        username: {
          [Op.iLike]: `${username}%`, 
        },
      },
      attributes: ['id', 'username'], 
      limit: 10,
    });

    if (!users.length) {
      return res.status(404).json({ error: 'No users found' });
    }

    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetUserByUsername;