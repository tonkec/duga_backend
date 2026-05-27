const { AppSession, Sequelize, User } = require('../models');
const {
  getCookie,
  getSessionId,
  hashSessionId,
  isValidSessionId,
  SESSION_COOKIE,
  SESSION_REVOKED_CODE,
} = require('../utils/appSession');

const sendRevoked = (res, message = 'Session revoked') =>
  res.status(401).json({ code: SESSION_REVOKED_CODE, message });

const requireActiveSession = async (req, res, next) => {
  try {
    const auth0Id = req.auth?.sub;
    const sessionCookie = getCookie(req, SESSION_COOKIE);
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendRevoked(res, 'Missing app session');
    }
    if (!isValidSessionId(sessionId)) {
      return sendRevoked(res, 'Invalid app session');
    }

    const sessionIdHash = hashSessionId(sessionId);
    const now = new Date();
    let session = null;

    if (AppSession?.findOne && sessionCookie) {
      session = await AppSession.findOne({
        where: {
          sessionIdHash,
          revokedAt: null,
          ...(Sequelize?.Op ? { expiresAt: { [Sequelize.Op.gt]: now } } : {}),
        },
      });

      if (session) {
        if (auth0Id && session.auth0Id !== auth0Id) {
          return sendRevoked(res);
        }
        await session.update?.({ lastSeenAt: now });
      }
    }

    if (AppSession?.findOne && sessionCookie && !session) {
      return sendRevoked(res);
    }

    const sessionAuth0Id = auth0Id || session?.auth0Id;
    if (!sessionAuth0Id) {
      return res.status(401).json({ message: 'Missing auth0Id in token' });
    }

    const user =
      req.currentUser ||
      (session?.userId
        ? await User.findByPk(session.userId)
        : await User.findOne({ where: { auth0Id: sessionAuth0Id } }));
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    if (!session && user.activeSessionIdHash !== sessionIdHash) {
      return sendRevoked(res);
    }

    req.currentUser = user;
    req.user = req.user || user;
    req.appSession = session || null;
    req.appSessionId = sessionId;
    req.auth = req.auth || { sub: sessionAuth0Id };
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
