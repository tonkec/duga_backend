const jwt = require('jsonwebtoken');
const getBearerToken = require('../utils/getBearerToken');
const {
  getApiJwtExpiresIn,
  getApiJwtSecret,
} = require('../utils/apiJwtConfig');

const API_JWT_SECRET = getApiJwtSecret();
const API_JWT_EXPIRES_IN = getApiJwtExpiresIn();

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
    API_JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: API_JWT_EXPIRES_IN,
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
      const decoded = jwt.verify(token, API_JWT_SECRET, {
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
