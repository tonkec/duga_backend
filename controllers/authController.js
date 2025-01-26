const User = require('../models').User;
const VerificationToken = require('../models').VerificationToken;
const bcrypt = require('bcrypt');
const config = require('../config/app');
const jwt = require('jsonwebtoken');
const {
  sendVerificationEmail,
} = require('./../helpers/emailHelpers/sendVerificationEmail');
const {
  sendResetPasswordEmail,
} = require('../helpers/emailHelpers/sendResetPasswordEmail');

exports.login = async (req, res) => {
  const { password, email } = req.body;
  try {
    const user = await User.findOne({
      where: {
        email: email,
      },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ message: 'Wrong credentials' });

    const userWithToken = generateToken(user.get({ raw: true }));
    userWithToken.avatar = user.avatar;
    return res.send(userWithToken);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const email = req.body.email;
  try {
    const user = await User.findOne({
      where: {
        email: email,
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const emailType = 'reset';
    createVerificationToken(user, emailType, res);
  } catch (e) {
    return res.status(500).json({ e: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  try {
    const [rows, result] = await User.update(req.body, {
      where: {
        email: email,
      },
      returning: true,
      individualHooks: true,
    });
    const user = result[0].get({ raw: true });
    delete user.password;
    user.password = password;
    return res.send(user);
  } catch (e) {
    return res.status(500).json({ e: e.message });
  }
};

exports.register = async (req, res) => {
  const {  email} = req.body;
  console.log(req.body, "BODYYY");

  try {
    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({  email });
      res.status(201).json({ message: 'User created', user });
    } else {
      res.status(200).json({ message: 'User already exists', user });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

const generateToken = (user) => {
  //   delete user.password;
  const token = jwt.sign(user, config.appKey, { expiresIn: 86400000 });
  return { ...user, ...{ token } };
};

const generateEmailVerificationToken = () => {
  return require('crypto').randomBytes(64).toString('hex');
};

const createVerificationToken = (user, type, res) => {
  const isVerification = type === 'verification' ? true : false;
  VerificationToken.create({
    userId: user.id,
    token: generateEmailVerificationToken(),
  })
    .then((result) => {
      const emailVerificationToken = result.token;
      isVerification
        ? sendVerificationEmail(user.email, emailVerificationToken)
        : sendResetPasswordEmail(user.email, emailVerificationToken);
      return res.send(user);
    })
    .catch((e) => console.log(e.message));
};
