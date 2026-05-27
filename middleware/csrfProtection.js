const { AppSession, Sequelize } = require('../models');
const {
  CSRF_HEADER,
  getCookie,
  hashSessionId,
  SESSION_COOKIE,
  CSRF_COOKIE,
} = require('../utils/appSession');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const tokensMatch = (left, right) =>
  typeof left === 'string' &&
  typeof right === 'string' &&
  left.length > 0 &&
  right.length > 0 &&
  left === right;

const csrfProtection = async (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  const sessionId = getCookie(req, SESSION_COOKIE);
  if (!sessionId) {
    return next();
  }

  const csrfCookie = getCookie(req, CSRF_COOKIE);
  const csrfHeader = req.get?.(CSRF_HEADER) || req.headers?.[CSRF_HEADER];

  if (!tokensMatch(csrfCookie, csrfHeader)) {
    return res.status(403).json({ ok: false, errors: ['csrf_failed'] });
  }

  if (AppSession?.findOne) {
    const session = await AppSession.findOne({
      where: {
        sessionIdHash: hashSessionId(sessionId),
        csrfTokenHash: hashSessionId(csrfCookie),
        revokedAt: null,
        ...(Sequelize?.Op
          ? { expiresAt: { [Sequelize.Op.gt]: new Date() } }
          : {}),
      },
    });

    if (!session) {
      return res.status(403).json({ ok: false, errors: ['csrf_failed'] });
    }
  }

  return next();
};

module.exports = csrfProtection;
