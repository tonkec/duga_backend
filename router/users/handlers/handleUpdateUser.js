const User = require('../../../models').User;
const { sanitizePlainText } = require('../../../utils/plainText');

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

const PROFILE_FIELD_LIMITS = {
  firstName: 80,
  lastName: 80,
  bio: 1000,
  sexuality: 80,
  gender: 80,
  location: 120,
  spirituality: 1000,
  embarasement: 1000,
  tooOldFor: 1000,
  makesMyDay: 1000,
  favoriteSong: 500,
  favoriteMovie: 500,
  interests: 500,
  languages: 500,
  ending: 1000,
};

const ENUM_VALUES = {
  lookingFor: new Set([
    'friendship',
    'date',
    'marriage',
    'relationship',
    'partnership',
    'nothing',
    'idk',
  ]),
  relationshipStatus: new Set([
    'single',
    'relationship',
    'marriage',
    'partnership',
    'inbetween',
    'idk',
    'divorced',
    'widowed',
    'separated',
    'open',
    'engaged',
  ]),
  favoriteDayOfWeek: new Set([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]),
};

const BOOLEAN_FIELDS = new Set(['cigarettes', 'alcohol', 'sport']);

const normalizeProfileValue = (modelField, value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (ENUM_VALUES[modelField] && value === '') {
    return null;
  }

  if (typeof value === 'string') {
    return sanitizePlainText(value);
  }

  return value;
};

const validateProfileValue = (modelField, value) => {
  if (value === null) return null;

  if (BOOLEAN_FIELDS.has(modelField)) {
    return typeof value === 'boolean'
      ? null
      : `${modelField} must be a boolean or null`;
  }

  const enumValues = ENUM_VALUES[modelField];
  if (enumValues) {
    return typeof value === 'string' && enumValues.has(value)
      ? null
      : `${modelField} is invalid`;
  }

  const maxLength = PROFILE_FIELD_LIMITS[modelField];
  if (maxLength) {
    if (typeof value !== 'string') {
      return `${modelField} must be a string or null`;
    }

    if (value.length > maxLength) {
      return `${modelField} must be ${maxLength} characters or less`;
    }
  }

  return null;
};

const sanitizeUser = (user) => {
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.auth0Id;
  delete safeUser.activeSessionIdHash;
  delete safeUser.activeSessionStartedAt;

  return safeUser;
};

const handleUpdateUser = async (req, res) => {
  const userId = req.auth.user.id;

  try {
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    const errors = [];
    const updateData = Object.entries(PROFILE_FIELDS).reduce(
      (acc, [requestField, modelField]) => {
        if (Object.prototype.hasOwnProperty.call(data, requestField)) {
          const value = normalizeProfileValue(modelField, data[requestField]);
          const error = validateProfileValue(modelField, value);
          if (error) {
            errors.push(error);
          } else {
            acc[modelField] = value;
          }
        }
        return acc;
      },
      {}
    );

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

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
