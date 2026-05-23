const attachCurrentUser = require('./attachCurrentUser');
const { checkApiJwt, checkApiJwtForFiles } = require('./apiJwt');
const requireActiveSession = require('./requireActiveSession');

const authenticatedAppSession = [checkApiJwt, attachCurrentUser, requireActiveSession];
const authenticatedFileSession = [checkApiJwtForFiles, attachCurrentUser, requireActiveSession];

module.exports = {
  authenticatedAppSession,
  authenticatedFileSession,
};
