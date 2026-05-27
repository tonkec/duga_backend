const ORIGIN_ENV_KEYS = [
  'ALLOWED_ORIGINS',
  'WEB_APP_ORIGINS',
  'APP_ORIGINS',
  'CLIENT_ORIGIN',
  'CLIENT_URL',
  'FRONTEND_URL',
];

const splitOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const normalizeOrigin = (origin) => {
  if (!origin) return null;

  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch (error) {
    return String(origin).replace(/\/+$/, '');
  }
};

const getAllowedOrigins = () =>
  new Set(
    ORIGIN_ENV_KEYS.flatMap((key) => splitOrigins(process.env[key])).map(
      normalizeOrigin
    )
  );

const isOriginAllowed = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  return Boolean(normalizedOrigin && getAllowedOrigins().has(normalizedOrigin));
};

const allowHttpCorsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (isOriginAllowed(origin)) return callback(null, true);

  return callback(new Error('Origin not allowed'));
};

const allowSocketOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) return callback(null, true);

  return callback(new Error('Socket origin not allowed'), false);
};

module.exports = {
  allowHttpCorsOrigin,
  allowSocketOrigin,
  getAllowedOrigins,
  isOriginAllowed,
  normalizeOrigin,
};
