const findClaimValue = (claims = {}, claimName) => {
  if (claims[claimName] !== undefined) {
    return claims[claimName];
  }

  const namespacedKey = Object.keys(claims).find(
    (key) =>
      typeof key === 'string' &&
      (key.endsWith(`/${claimName}`) || key.endsWith(`:${claimName}`))
  );

  return namespacedKey ? claims[namespacedKey] : undefined;
};

const getAuth0IdentityClaims = (claims = {}) => {
  const email = findClaimValue(claims, 'email');
  const emailVerified = findClaimValue(claims, 'email_verified');

  return {
    sub: claims.sub,
    email: typeof email === 'string' ? email : undefined,
    email_verified:
      typeof emailVerified === 'boolean' ? emailVerified : undefined,
  };
};

module.exports = {
  getAuth0IdentityClaims,
};
