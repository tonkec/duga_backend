const { User } = require('../models');
const { getSessionId, hashSessionId, SESSION_REVOKED_CODE } = require('../utils/appSession');

const sendRevoked = (res, message = 'Session revoked') =>
  res.status(401).json({ code: SESSION_REVOKED_CODE, message });

const requireActiveSession = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.sub;
    if (!auth0Id) {
      return res.status(401).json({ message: 'Missing auth0Id in token' });
    }

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendRevoked(res, 'Missing app session');
    }

    const user = req.currentUser || (await User.findOne({ where: { auth0Id } }));
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    if (!user.activeSessionIdHash || user.activeSessionIdHash !== hashSessionId(sessionId)) {
      return sendRevoked(res);
    }

    req.currentUser = user;
    req.user = req.user || user;
    req.auth.user = req.auth.user || {
      id: user.id,
      email: user.email,
      auth0Id: user.auth0Id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireActiveSession;
