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

const verifyUser = (user) => {
  return user
    .update({ isVerified: true })
    .then(() => {
      return res.status(200).json(emailHasBeenVerified(user));
    })
    .catch((e) => {
      return res.status(403).json({ e: e.message });
    });
};

const tokenHasExpired = (res) => {
  return res.status(404).json(TOKEN_EXPIRED);
};

const findVerificationToken = (req, res, user) => {
  return verificationToken(req)
    .then((foundToken) => {
      if (foundToken) {
        verifyUser(user);
      }
      tokenHasExpired(res);
    })
    .catch(() => {
      return res.status(404).json(TOKEN_EXPIRED);
    });
};

exports.verify = (req, res) => {
  const isUserVerified = (user) => user.dataValues.isVerified;
  return signedUpUser(req)
    .then((user) => {
      if (isUserVerified(user)) {
        return res.status(202).json(EMAIL_ALREADY_VERIFIED);
      }
      findVerificationToken(req, res, user);
    })
    .catch((reason) => {
      console.log(reason);
      return res.status(404).json(EMAIL_NOT_FOUND);
    });
};
