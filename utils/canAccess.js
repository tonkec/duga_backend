const canAccess = (user, resource) => {
    console.log(user, "USER")
  console.log(resource, "RESOURCE")
  if (!user || !resource) return false;

  if ('auth0Id' in resource && resource.auth0Id === user.auth0Id) return true;
  if ('userId' in resource && resource.userId === user.id) return true;
  if ('fromUserId' in resource && resource.fromUserId === user.id) return true;

  return user.role === 'admin';
};
module.exports = canAccess;