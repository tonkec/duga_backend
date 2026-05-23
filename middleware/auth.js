const { expressjwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const getBearerToken = require('../utils/getBearerToken');

const jwtOptions = {
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
};

const checkJwt = expressjwt(jwtOptions);

const checkJwtForFiles = expressjwt({
  ...jwtOptions,
  getToken: (req) => getBearerToken(req),
});

module.exports = { checkJwt, checkJwtForFiles };
