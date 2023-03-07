const User = require('../models').User;
const VerificationToken = require('../models').VerificationToken;
const { Op } = require('sequelize');
const EMAIL_ALREADY_VERIFIED = `Email Already Verified`;
const EMAIL_NOT_FOUND = `Email not found`;
const TOKEN_EXPIRED = 'Token expired';

const emailHasBeenVerified = (user) =>
  `User with ${user.email} has been verified`;

const signedUpUser = (req) =>
  User.findOne({
    where: {
      [Op.or]: [
        {
          email: req.query.email,
        },
      ],
    },
  });

const verificationToken = (req) =>
  VerificationToken.findOne({
    where: {
      [Op.or]: [
        {
          token: req.query.token,
        },
      ],
    },
  });

const onError = (e, res) => res.status(403).json({ e: e.message });

const verifyUser = (res, user) => {
  return user
    .update({ isVerified: true })
    .then(() => {
      return res.status(200).json({ message: emailHasBeenVerified(user) });
    })
    .catch((e) => {
      onError(e, res);
    });
};

const onTokenHasExpired = (res) => {
  return res.status(404).json({ message: TOKEN_EXPIRED });
};

const findVerificationToken = (req, res, user) => {
  return verificationToken(req)
    .then((foundToken) => {
      if (foundToken) {
        verifyUser(res, user);
      } else {
        onTokenHasExpired(res);
      }
    })
    .catch((e, res) => {
      onError(e, res);
    });
};

const onEmailAlreadyVerified = (res) =>
  res.status(202).json({ message: EMAIL_ALREADY_VERIFIED });

const onEmailNotFound = (res) =>
  res.status(404).json({ message: EMAIL_NOT_FOUND });

exports.verify = (req, res) => {
  const isUserVerified = (user) => user.dataValues.isVerified;
  return signedUpUser(req)
    .then((user) => {
      if (isUserVerified(user)) {
        onEmailAlreadyVerified(res);
      } else {
        findVerificationToken(req, res, user);
      }
    })
    .catch(() => {
      onEmailNotFound(res);
    });
};
