const canAccess = (user,resource) => {
  if (!user || !resource) return false;

  if (resource.auth0Id === user.sub) return true;

  // 2. Admin override TODO
  if (user.role === 'admin') return true;

  return false;
};

module.exports = canAccess;