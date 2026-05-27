const PUBLIC_USER_ATTRIBUTES = [
  'id',
  'publicId',
  'username',
  'avatar',
  'status',
];

const serializePublicUser = (user) => {
  if (!user) return null;

  const plain = user.toJSON?.() || user;

  return PUBLIC_USER_ATTRIBUTES.reduce((publicUser, attribute) => {
    if (Object.prototype.hasOwnProperty.call(plain, attribute)) {
      publicUser[attribute] = plain[attribute];
    }

    return publicUser;
  }, {});
};

module.exports = {
  PUBLIC_USER_ATTRIBUTES,
  serializePublicUser,
};
