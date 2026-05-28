const crypto = require('crypto');

const SESSION_HEADER = 'x-duga-session-id';
const SESSION_COOKIE = 'duga_session';
const CSRF_COOKIE = 'duga_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
const SESSION_CONFLICT_CODE = 'SESSION_CONFLICT';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const CROSS_SITE_COOKIE_ENVIRONMENTS = new Set(['production', 'staging']);
const SESSION_TTL_MS = Number(
  process.env.DUGA_SESSION_TTL_MS ?? 7 * 24 * 60 * 60 * 1000
);

const generateSessionId = () => crypto.randomBytes(32).toString('base64url');
const generateCsrfToken = () => crypto.randomBytes(32).toString('base64url');

const isValidSessionId = (sessionId) =>
  typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId);

const hashSessionId = (sessionId) =>
  crypto.createHash('sha256').update(String(sessionId)).digest('hex');

const parseCookies = (cookieHeader = '') =>
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!name) return cookies;

      try {
        cookies[name] = decodeURIComponent(value);
      } catch (error) {
        cookies[name] = value;
      }

      return cookies;
    }, {});

const getCookie = (req, name) =>
  parseCookies(req.headers?.cookie)[name] || null;

const getSessionId = (req) =>
  getCookie(req, SESSION_COOKIE) ||
  req.get?.(SESSION_HEADER) ||
  req.headers?.[SESSION_HEADER] ||
  null;

const getCsrfToken = (req) => getCookie(req, CSRF_COOKIE);

const getSessionExpiry = (from = new Date()) =>
  new Date(from.getTime() + SESSION_TTL_MS);

const isCrossSiteCookieEnvironment = () =>
  CROSS_SITE_COOKIE_ENVIRONMENTS.has(process.env.NODE_ENV);

const getCookieSameSite = () =>
  process.env.DUGA_COOKIE_SAMESITE ||
  (isCrossSiteCookieEnvironment() ? 'none' : 'lax');

const shouldUseSecureCookies = () =>
  process.env.DUGA_COOKIE_SECURE === 'true' || isCrossSiteCookieEnvironment();

const buildCookieOptions = ({ httpOnly, maxAgeMs = SESSION_TTL_MS } = {}) => {
  const options = {
    httpOnly,
    sameSite: getCookieSameSite(),
    secure: shouldUseSecureCookies(),
    path: '/',
  };

  if (process.env.DUGA_COOKIE_DOMAIN) {
    options.domain = process.env.DUGA_COOKIE_DOMAIN;
  }
  if (maxAgeMs != null) {
    options.maxAge = maxAgeMs;
  }

  return options;
};

const buildClearCookieOptions = ({ httpOnly } = {}) => {
  const options = {
    httpOnly,
    sameSite: getCookieSameSite(),
    secure: shouldUseSecureCookies(),
    path: '/',
  };

  if (process.env.DUGA_COOKIE_DOMAIN) {
    options.domain = process.env.DUGA_COOKIE_DOMAIN;
  }

  return options;
};

const setSessionCookies = (res, { sessionId, csrfToken, maxAgeMs } = {}) => {
  res.cookie(SESSION_COOKIE, sessionId, {
    ...buildCookieOptions({ httpOnly: true, maxAgeMs }),
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...buildCookieOptions({ httpOnly: false, maxAgeMs }),
  });
};

const clearSessionCookies = (res) => {
  res.clearCookie(SESSION_COOKIE, {
    ...buildClearCookieOptions({ httpOnly: true }),
  });
  res.clearCookie(CSRF_COOKIE, {
    ...buildClearCookieOptions({ httpOnly: false }),
  });
};

module.exports = {
  SESSION_HEADER,
  SESSION_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_REVOKED_CODE,
  SESSION_CONFLICT_CODE,
  SESSION_ID_PATTERN,
  SESSION_TTL_MS,
  clearSessionCookies,
  generateCsrfToken,
  generateSessionId,
  getCookie,
  getCsrfToken,
  getSessionExpiry,
  hashSessionId,
  getSessionId,
  isValidSessionId,
  parseCookies,
  setSessionCookies,
};
