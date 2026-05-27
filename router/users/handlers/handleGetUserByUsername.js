const User = require('../../../models').User;
const { Op } = require('sequelize');

const MIN_USERNAME_PREFIX_LENGTH = 3;
const LIKE_ESCAPE_CHAR = '\\';
const LIKE_WILDCARD_PATTERN = /([\\%_])/g;

const normalizeUsernamePrefix = (username) =>
  typeof username === 'string' ? username.trim() : '';

const escapeLikePattern = (value) =>
  value.replace(LIKE_WILDCARD_PATTERN, `${LIKE_ESCAPE_CHAR}$1`);

const handleGetUserByUsername = async (req, res) => {
  try {
    const username = normalizeUsernamePrefix(req.params.username);

    if (!username) {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    if (username.length < MIN_USERNAME_PREFIX_LENGTH) {
      return res.status(400).json({
        error: `Username search must be at least ${MIN_USERNAME_PREFIX_LENGTH} characters`,
      });
    }

    const escapedUsername = escapeLikePattern(username);

    const users = await User.findAll({
      where: {
        username: {
          [Op.iLike]: `${escapedUsername}%`,
          [Op.escape]: LIKE_ESCAPE_CHAR,
        },
      },
      attributes: ['id', 'publicId', 'username'],
      limit: 10,
    });

    if (!users.length) {
      return res.json([]);
    }

    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetUserByUsername;
