const crypto = require('crypto');

const SESSION_HEADER = 'x-duga-session-id';
const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
const SESSION_CONFLICT_CODE = 'SESSION_CONFLICT';

const hashSessionId = (sessionId) =>
  crypto.createHash('sha256').update(String(sessionId)).digest('hex');

const getSessionId = (req) =>
  req.get?.(SESSION_HEADER) ||
  req.headers?.[SESSION_HEADER] ||
  req.body?.sessionId ||
  null;

module.exports = {
  SESSION_HEADER,
  SESSION_REVOKED_CODE,
  SESSION_CONFLICT_CODE,
  hashSessionId,
  getSessionId,
};
