const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }
  }
  if (req.query?.access_token) {
    return req.query.access_token;
  }
  return null;
};

module.exports = getBearerToken;
