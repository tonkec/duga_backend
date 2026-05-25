const attachCurrentUser = require('./attachCurrentUser');
const { checkJwt, checkJwtForFiles } = require('./auth');
const { checkApiJwt, checkApiJwtForFiles } = require('./apiJwt');
const requireActiveSession = require('./requireActiveSession');
const getBearerToken = require('../utils/getBearerToken');
const jwt = require('jsonwebtoken');

const isAuth0Token = (req) => {
  const token = getBearerToken(req);
  const decoded = token ? jwt.decode(token, { complete: true }) : null;

  return decoded?.header?.alg === 'RS256';
};

const verifyAppJwt = (req, res, next) => {
  const verifier = isAuth0Token(req) ? checkJwt : checkApiJwt;
  return verifier(req, res, next);
};

const verifyFileJwt = (req, res, next) => {
  const verifier = isAuth0Token(req) ? checkJwtForFiles : checkApiJwtForFiles;
  return verifier(req, res, next);
};

const authenticatedAppSession = [
  verifyAppJwt,
  attachCurrentUser,
  requireActiveSession,
];
const authenticatedFileSession = [
  verifyFileJwt,
  attachCurrentUser,
  requireActiveSession,
];

module.exports = {
  authenticatedAppSession,
  authenticatedFileSession,
};
