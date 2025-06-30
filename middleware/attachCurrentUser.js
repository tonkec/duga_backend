const { User } = require('../models');

const attachCurrentUser = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.sub;
    if (!auth0Id) {
      return res.status(401).json({ message: 'Missing auth0Id in token' });
    }

    const user = await User.findOne({ where: { auth0Id } });

     if (!user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    req.auth.user = {
      id: user.id,
      email: user.email,
      auth0Id: user.auth0Id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = attachCurrentUser;
