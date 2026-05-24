const User = require('../../../models').User;

const PROFILE_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  bio: 'bio',
  sexuality: 'sexuality',
  gender: 'gender',
  location: 'location',
  lookingFor: 'lookingFor',
  relationshipStatus: 'relationshipStatus',
  cigarettes: 'cigarettes',
  alcohol: 'alcohol',
  sport: 'sport',
  favoriteDay: 'favoriteDayOfWeek',
  spirituality: 'spirituality',
  embarasement: 'embarasement',
  tooOldFor: 'tooOldFor',
  makesMyDay: 'makesMyDay',
  favoriteSong: 'favoriteSong',
  favoriteMovie: 'favoriteMovie',
  interests: 'interests',
  languages: 'languages',
  ending: 'ending',
};

const sanitizeUser = (user) => {
  const {
    password,
    auth0Id,
    activeSessionIdHash,
    activeSessionStartedAt,
    ...safeUser
  } = user;

  return safeUser;
};

const handleUpdateUser = async (req, res) => {
  const userId = req.auth.user.id;

  try {
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    const updateData = Object.entries(PROFILE_FIELDS).reduce(
      (acc, [requestField, modelField]) => {
        if (Object.prototype.hasOwnProperty.call(data, requestField)) {
          acc[modelField] = data[requestField] ?? null;
        }
        return acc;
      },
      {}
    );

    const [rows, result] = await User.update(updateData, {
      where: {
        id: userId,
      },
      returning: true,
      individualHooks: true,
    });

    if (!rows || !result?.[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = sanitizeUser(result[0].get({ raw: true }));
    user.avatar = result[0].avatar;

    return res.send(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleUpdateUser;
