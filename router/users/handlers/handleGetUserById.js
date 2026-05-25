const { ProfileView, User } = require('../../../models');

const handleGetUserById = async (req, res) => {
  try {
    const viewedUserId = req.params.id;
    const viewerId = req.auth.user.id;
    const user = await User.findByPk(req.params.id, {
      attributes: {
        exclude: [
          'password',
          'auth0Id',
          'activeSessionIdHash',
          'activeSessionStartedAt',
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(viewedUserId) !== String(viewerId)) {
      const profileView = await ProfileView.create({
        viewerId,
        viewedUserId,
      });
      const io = req.app?.get?.('io');
      const viewer = req.currentUser || req.user || req.auth.user;
      const profileViewData = profileView?.toJSON?.() || profileView || {};

      if (io?.to) {
        io.to(`user:${viewedUserId}`).emit('profile-view-created', {
          data: {
            ...profileViewData,
            viewerId,
            viewedUserId,
            viewer: {
              id: viewer?.id,
              username: viewer?.username,
              firstName: viewer?.firstName,
              lastName: viewer?.lastName,
              avatar: viewer?.avatar,
            },
          },
        });
      }
    }

    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetUserById;
