const User = require('../../../models').User;
const {
  PUBLIC_USER_ATTRIBUTES,
  serializePublicUser,
} = require('../../../utils/publicUser');
const {
  buildRateLimitKeys,
  consumeAuthRateLimit,
} = require('../../../utils/authRateLimit');

const MAX_USERS_LIMIT = 50;
const USER_ENUMERATION_RATE_LIMIT_MS = Number(
  process.env.USER_ENUMERATION_RATE_LIMIT_MS ?? 10 * 1000
);

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const handleGetAllUsers = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query?.page);
    const requestedLimit = parsePositiveInteger(req.query?.limit);

    if (!page || !requestedLimit) {
      return res.status(400).json({
        errors: ['page and limit query parameters are required'],
      });
    }

    const rateLimit = await consumeAuthRateLimit({
      action: 'user_enumeration',
      keys: buildRateLimitKeys(req),
      windowMs: USER_ENUMERATION_RATE_LIMIT_MS,
    });

    if (rateLimit.limited) {
      res.set?.('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({ errors: ['rate_limited'] });
    }

    const limit = Math.min(requestedLimit, MAX_USERS_LIMIT);
    const offset = (page - 1) * limit;
    const { rows, count } = await User.findAndCountAll({
      attributes: PUBLIC_USER_ATTRIBUTES,
      order: [['id', 'ASC']],
      limit,
      offset,
    });

    return res.json({
      data: rows.map(serializePublicUser),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetAllUsers;
