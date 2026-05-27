const crypto = require('crypto');

const SESSION_HEADER = 'x-duga-session-id';
const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
const SESSION_CONFLICT_CODE = 'SESSION_CONFLICT';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const generateSessionId = () => crypto.randomBytes(32).toString('base64url');

const isValidSessionId = (sessionId) =>
  typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId);

const hashSessionId = (sessionId) =>
  crypto.createHash('sha256').update(String(sessionId)).digest('hex');

const getSessionId = (req) =>
  req.get?.(SESSION_HEADER) || req.headers?.[SESSION_HEADER] || null;

module.exports = {
  SESSION_HEADER,
  SESSION_REVOKED_CODE,
  SESSION_CONFLICT_CODE,
  SESSION_ID_PATTERN,
  generateSessionId,
  hashSessionId,
  getSessionId,
  isValidSessionId,
};
