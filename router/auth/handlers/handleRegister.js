const { User } = require('../../../models');

const serializeUser = (user) => {
  const data = user.toJSON();
  delete data.auth0Id;
  delete data.activeSessionIdHash;
  delete data.activeSessionStartedAt;
  return data;
};

const handleRegister = async (req, res) => {
  const auth0Id = req.auth?.sub;
  const email = req.auth?.email;
  const { username } = req.body || {};

  if (!auth0Id || !email) {
    return res.status(401).json({ message: 'Missing Auth0 identity claims' });
  }

  if (!username) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
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
      username,
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
