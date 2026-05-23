const attachCurrentUser = require('./attachCurrentUser');
const { checkJwt, checkJwtForFiles } = require('./auth');
const requireActiveSession = require('./requireActiveSession');

const authenticatedAppSession = [checkJwt, attachCurrentUser, requireActiveSession];
const authenticatedFileSession = [checkJwtForFiles, attachCurrentUser, requireActiveSession];

module.exports = {
  authenticatedAppSession,
  authenticatedFileSession,
};
