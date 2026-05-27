const axios = require('axios');
const { User } = require('../../../models');
const { getAuth0IdentityClaims } = require('../../../utils/auth0Claims');
const getBearerToken = require('../../../utils/getBearerToken');

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;
const SAFE_USER_FIELDS = ['id', 'publicId', 'email', 'username'];

const serializeUser = (user) => {
  const data = user.toJSON();
  return SAFE_USER_FIELDS.reduce((safeUser, field) => {
    if (
      Object.prototype.hasOwnProperty.call(data, field) &&
      data[field] !== undefined
    ) {
      safeUser[field] = data[field];
    }

    return safeUser;
  }, {});
};

const getUserInfoClaims = async (req) => {
  const token = getBearerToken(req);
  if (!token || !process.env.AUTH0_DOMAIN) {
    return {};
  }

  const response = await axios.get(
    `https://${process.env.AUTH0_DOMAIN}/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return getAuth0IdentityClaims(response.data);
};

const handleRegister = async (req, res) => {
  let { sub: auth0Id, email } = getAuth0IdentityClaims(req.auth);
  const { username } = req.body || {};
  const normalizedUsername =
    typeof username === 'string' ? username.trim() : username;

  if (!normalizedUsername) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (
    typeof normalizedUsername !== 'string' ||
    !USERNAME_PATTERN.test(normalizedUsername)
  ) {
    return res.status(400).json({
      message:
        'Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or hyphens',
    });
  }

  try {
    if (auth0Id && !email) {
      const userInfoClaims = await getUserInfoClaims(req);

      if (userInfoClaims.sub && userInfoClaims.sub !== auth0Id) {
        return res.status(401).json({ message: 'Auth0 identity mismatch' });
      }

      email = userInfoClaims.email;
    }

    if (!auth0Id || !email) {
      return res.status(401).json({ message: 'Missing Auth0 identity claims' });
    }

    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ where: { auth0Id } });

    if (user) {
      return res
        .status(200)
        .json({ message: 'User already exists', user: serializeUser(user) });
    }

    user = await User.findOne({ where: { email: normalizedEmail } });

    if (user) {
      if (user.auth0Id) {
        return res.status(409).json({ message: 'Email is already registered' });
      }

      user = await user.update({ auth0Id });

      return res
        .status(200)
        .json({ message: 'User already exists', user: serializeUser(user) });
    }

    user = await User.create({
      auth0Id,
      email: normalizedEmail,
      username: normalizedUsername,
    });

    console.log('User created');
    return res
      .status(201)
      .json({ message: 'User created', user: serializeUser(user) });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

module.exports = handleRegister;
