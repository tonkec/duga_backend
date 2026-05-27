const { AuthRateLimit } = require('../models');

const normalizeKeyPart = (value) => String(value || 'unknown').trim();

const getClientIp = (req) => {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const buildRateLimitKeys = (req, userKey) => [
  `user:${normalizeKeyPart(userKey || req.auth?.sub)}`,
  `ip:${normalizeKeyPart(getClientIp(req))}`,
];

const consumeAuthRateLimit = async ({ action, keys, windowMs }) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const normalizedKeys = [...new Set(keys.filter(Boolean))];

  const existingLimits = await Promise.all(
    normalizedKeys.map((key) =>
      AuthRateLimit.findOne({
        where: { action, key },
      })
    )
  );

  const activeLimit = existingLimits.find(
    (limit) => limit && new Date(limit.expiresAt) > now
  );

  if (activeLimit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (new Date(activeLimit.expiresAt).getTime() - now.getTime()) / 1000
        )
      ),
    };
  }

  await Promise.all(
    normalizedKeys.map(async (key, index) => {
      if (typeof AuthRateLimit.upsert === 'function') {
        await AuthRateLimit.upsert({ action, key, expiresAt });
        return;
      }

      const existingLimit = existingLimits[index];
      if (existingLimit) {
        await existingLimit.update({ expiresAt });
        return;
      }

      await AuthRateLimit.create({ action, key, expiresAt });
    })
  );

  return { limited: false, retryAfterSeconds: 0 };
};

module.exports = {
  buildRateLimitKeys,
  consumeAuthRateLimit,
  getClientIp,
};
