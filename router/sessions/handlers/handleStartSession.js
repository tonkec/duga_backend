const { User } = require('../../../models');
const { signApiToken } = require('../../../middleware/apiJwt');
const {
  getSessionId,
  hashSessionId,
  isValidSessionId,
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
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.status(400).json({ ok: false, errors: ['missing_session_id'] });
  }
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ ok: false, errors: ['invalid_session_id'] });
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

    const userId = req.auth?.user?.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ ok: false, errors: ['user_not_found'] });
    }

    const nextSessionHash = hashSessionId(sessionId);
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

    await user.update({
      activeSessionIdHash: nextSessionHash,
      activeSessionStartedAt: new Date(),
    });

    const revokeUserSessionsExcept = req.app.get('revokeUserSessionsExcept');
    if (typeof revokeUserSessionsExcept === 'function') {
      revokeUserSessionsExcept(user.id, sessionId);
    }

    return res.json({
      ok: true,
      token: signApiToken(user),
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ ok: false, errors: ['server_error'] });
  }
};

module.exports = handleStartSession;
