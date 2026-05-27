const { ProfileView, User } = require('../../../models');
const {
  PUBLIC_USER_ATTRIBUTES,
  serializePublicUser,
} = require('../../../utils/publicUser');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handleGetUserById = async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const viewerId = req.auth.user.id;
    const queryOptions = {
      attributes: PUBLIC_USER_ATTRIBUTES,
    };
    const user = UUID_PATTERN.test(requestedUserId)
      ? await User.findOne({
          where: { publicId: requestedUserId },
          ...queryOptions,
        })
      : await User.findByPk(requestedUserId, queryOptions);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const viewedUserId = user.id;

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
              publicId: viewer?.publicId,
              username: viewer?.username,
              firstName: viewer?.firstName,
              lastName: viewer?.lastName,
              avatar: viewer?.avatar,
            },
          },
        });
      }
    }

    return res.json(serializePublicUser(user));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetUserById;
