const { AppSession, Sequelize, User } = require('../../../models');
const {
  generateCsrfToken,
  generateSessionId,
  getSessionExpiry,
  hashSessionId,
  setSessionCookies,
  SESSION_CONFLICT_CODE,
} = require('../../../utils/appSession');
const {
  buildRateLimitKeys,
  consumeAuthRateLimit,
} = require('../../../utils/authRateLimit');

const START_SESSION_RATE_LIMIT_MS = Number(
  process.env.START_SESSION_RATE_LIMIT_MS ?? 10 * 1000
);

const handleStartSession = async (req, res) => {
  const auth0Id = req.auth?.sub;
  const email = req.auth?.email;
  const emailVerified = req.auth?.email_verified;

  if (!auth0Id) {
    return res.status(401).json({ ok: false, errors: ['missing_auth0_sub'] });
  }

  try {
    const rateLimit = await consumeAuthRateLimit({
      action: 'session_start',
      keys: buildRateLimitKeys(req),
      windowMs: START_SESSION_RATE_LIMIT_MS,
    });

    if (rateLimit.limited) {
      res.set?.('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        ok: false,
        errors: ['rate_limited'],
      });
    }

    const user =
      req.currentUser || (await User.findOne({ where: { auth0Id } }));
    if (!user) {
      return res.status(404).json({ ok: false, errors: ['user_not_found'] });
    }

    const sessionId = generateSessionId();
    const csrfToken = generateCsrfToken();
    const nextSessionHash = hashSessionId(sessionId);
    const now = new Date();
    const expiresAt = getSessionExpiry(now);
    const shouldReplaceExistingSession = req.body?.force !== false;
    const hasDifferentActiveSession =
      user.activeSessionIdHash && user.activeSessionIdHash !== nextSessionHash;

    if (hasDifferentActiveSession && !shouldReplaceExistingSession) {
      return res.status(409).json({
        ok: false,
        code: SESSION_CONFLICT_CODE,
        errors: ['session_conflict'],
      });
    }

    if (AppSession?.update) {
      await AppSession.update(
        {
          revokedAt: now,
          rotatedAt: now,
        },
        {
          where: {
            userId: user.id,
            revokedAt: null,
            ...(Sequelize?.Op ? { expiresAt: { [Sequelize.Op.gt]: now } } : {}),
          },
        }
      );
    }

    if (AppSession?.create) {
      await AppSession.create({
        userId: user.id,
        auth0Id,
        sessionIdHash: nextSessionHash,
        csrfTokenHash: hashSessionId(csrfToken),
        userAgent: req.get?.('user-agent') || null,
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
        expiresAt,
        rotationVersion: 0,
        lastSeenAt: now,
      });
    }

    const userUpdate = {
      activeSessionIdHash: nextSessionHash,
      activeSessionStartedAt: now,
    };
    if (email && user.email !== email) {
      userUpdate.email = email;
    }
    if (typeof emailVerified === 'boolean') {
      userUpdate.isVerified = emailVerified;
    }

    await user.update(userUpdate);

    const revokeUserSessionsExcept = req.app.get('revokeUserSessionsExcept');
    if (typeof revokeUserSessionsExcept === 'function') {
      revokeUserSessionsExcept(user.id, sessionId);
    }

    setSessionCookies(res, { sessionId, csrfToken });

    return res.json({
      ok: true,
      session: {
        authenticated: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ ok: false, errors: ['server_error'] });
  }
};

module.exports = handleStartSession;
