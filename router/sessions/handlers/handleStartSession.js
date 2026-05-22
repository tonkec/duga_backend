const { User } = require('../../../models');
const { getSessionId, hashSessionId } = require('../../../utils/appSession');

const handleStartSession = async (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.status(400).json({ ok: false, errors: ['missing_session_id'] });
  }

  try {
    const userId = req.auth?.user?.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ ok: false, errors: ['user_not_found'] });
    }

    await user.update({
      activeSessionIdHash: hashSessionId(sessionId),
      activeSessionStartedAt: new Date(),
    });

    const revokeUserSessionsExcept = req.app.get('revokeUserSessionsExcept');
    if (typeof revokeUserSessionsExcept === 'function') {
      revokeUserSessionsExcept(user.id, sessionId);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ ok: false, errors: ['server_error'] });
  }
};

module.exports = handleStartSession;
