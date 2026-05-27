const { AppSession } = require('../../../models');
const {
  clearSessionCookies,
  getSessionId,
  hashSessionId,
} = require('../../../utils/appSession');

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
    const sessionIdHash = hashSessionId(sessionId);
    const now = new Date();

    if (req.appSession?.update) {
      await req.appSession.update({ revokedAt: now });
    } else if (AppSession?.update) {
      await AppSession.update(
        { revokedAt: now },
        { where: { sessionIdHash, userId: user.id, revokedAt: null } }
      );
    }

    if (user.activeSessionIdHash === sessionIdHash) {
      await user.update({
        activeSessionIdHash: null,
        activeSessionStartedAt: null,
      });
    }

    const revokeUserSession = req.app.get('revokeUserSession');
    if (typeof revokeUserSession === 'function') {
      revokeUserSession(user.id, sessionId);
    }

    clearSessionCookies(res);

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error logging out session:', error);
    return res.status(500).json({ ok: false, errors: ['server_error'] });
  }
};

module.exports = handleLogoutSession;
