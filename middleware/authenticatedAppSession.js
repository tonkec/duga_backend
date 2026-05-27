const attachCurrentUser = require('./attachCurrentUser');
const { checkJwt, checkJwtForFiles } = require('./auth');
const { checkApiJwt, checkApiJwtForFiles } = require('./apiJwt');
const requireActiveSession = require('./requireActiveSession');
const getBearerToken = require('../utils/getBearerToken');
const { getCookie, SESSION_COOKIE } = require('../utils/appSession');
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

const runMiddlewares = (middlewares, req, res, next) => {
  let index = 0;

  const runNext = (error) => {
    if (error) return next(error);

    const middleware = middlewares[index];
    index += 1;

    if (!middleware) return next();
    return middleware(req, res, runNext);
  };

  return runNext();
};

const authenticateWithCookieOrJwt = (verifyJwt) => (req, res, next) => {
  if (getCookie(req, SESSION_COOKIE)) {
    return requireActiveSession(req, res, next);
  }

  return runMiddlewares(
    [verifyJwt, attachCurrentUser, requireActiveSession],
    req,
    res,
    next
  );
};

const authenticatedAppSession = [authenticateWithCookieOrJwt(verifyAppJwt)];
const authenticatedFileSession = [authenticateWithCookieOrJwt(verifyFileJwt)];

module.exports = {
  authenticatedAppSession,
  authenticatedFileSession,
};
