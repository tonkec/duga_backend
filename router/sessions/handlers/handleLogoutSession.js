const { getSessionId, hashSessionId } = require('../../../utils/appSession');

const handleLogoutSession = async (req, res) => {
  const sessionId = getSessionId(req);
  const user = req.currentUser;

  if (!sessionId) {
    return res.status(400).json({ ok: false, errors: ['missing_session_id'] });
  }

  if (!user) {
    return res.status(401).json({ ok: false, errors: ['unauthorized'] });
  }

  try {
    if (user.activeSessionIdHash === hashSessionId(sessionId)) {
      await user.update({
        activeSessionIdHash: null,
        activeSessionStartedAt: null,
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error logging out session:', error);
    return res.status(500).json({ ok: false, errors: ['server_error'] });
  }
};

module.exports = handleLogoutSession;
