const jwt = require('jsonwebtoken');
const getBearerToken = require('../utils/getBearerToken');
const {
  getApiJwtExpiresIn,
  getApiJwtSecret,
} = require('../utils/apiJwtConfig');

const signApiToken = (user) =>
  jwt.sign(
    {
      sub: user.auth0Id,
      user: {
        id: user.id,
        email: user.email,
        auth0Id: user.auth0Id,
      },
      tokenUse: 'api',
    },
    getApiJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: getApiJwtExpiresIn(),
    }
  );

const verifyApiJwt =
  (getToken = getBearerToken) =>
  (req, res, next) => {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, getApiJwtSecret(), {
        algorithms: ['HS256'],
      });

      if (decoded.tokenUse !== 'api') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.auth = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

module.exports = {
  signApiToken,
  checkApiJwt: verifyApiJwt(),
  checkApiJwtForFiles: verifyApiJwt((req) => getBearerToken(req)),
};
