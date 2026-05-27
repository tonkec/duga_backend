const DEFAULT_API_JWT_EXPIRES_IN = '15m';
const MAX_API_JWT_TTL_SECONDS = 60 * 60;
const MIN_API_JWT_SECRET_BYTES = 32;

const isTestEnv = () =>
  process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);

const getApiJwtSecret = () => {
  const secret = process.env.API_JWT_SECRET || process.env.JWT_SECRET;

  if (isTestEnv()) {
    return secret || 'duga-api-test-secret';
  }

  if (!secret) {
    throw new Error('API_JWT_SECRET is required outside test environments');
  }

  if (Buffer.byteLength(secret, 'utf8') < MIN_API_JWT_SECRET_BYTES) {
    throw new Error(
      `API_JWT_SECRET must be at least ${MIN_API_JWT_SECRET_BYTES} bytes`
    );
  }

  if (/^(duga-api-test-secret|test|secret|password|changeme)$/i.test(secret)) {
    throw new Error('API_JWT_SECRET must not use a default or guessable value');
  }

  return secret;
};

const parseTtlSeconds = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return null;

  const match = String(value)
    .trim()
    .match(/^(\d+)\s*(s|m|h)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1, m: 60, h: 60 * 60 };

  return amount * multipliers[unit];
};

const getApiJwtExpiresIn = () => {
  const expiresIn =
    process.env.API_JWT_EXPIRES_IN || DEFAULT_API_JWT_EXPIRES_IN;
  const ttlSeconds = parseTtlSeconds(expiresIn);

  if (!isTestEnv() && (!ttlSeconds || ttlSeconds > MAX_API_JWT_TTL_SECONDS)) {
    throw new Error('API_JWT_EXPIRES_IN must be 1h or shorter');
  }

  return expiresIn;
};

module.exports = {
  DEFAULT_API_JWT_EXPIRES_IN,
  MAX_API_JWT_TTL_SECONDS,
  MIN_API_JWT_SECRET_BYTES,
  getApiJwtExpiresIn,
  getApiJwtSecret,
  parseTtlSeconds,
};
