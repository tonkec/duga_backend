const { User } = require('../../../models');

const getUsersByUsernames = async (req, res) => {
  try {
    const { usernames } = req.body;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ message: 'Usernames must be a non-empty array.' });
    }

    const users = await User.findAll({
      where: {
        username: usernames,
      },
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users by usernames:', error);
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
};

module.exports = getUsersByUsernames;
