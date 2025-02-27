const User = require('../models').User;

exports.register = async (req, res) => {
  const { email } = req.body;
  try {
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create(req.body);

      res.status(201).json({ message: 'User created', user });
    } else {
      res.status(200).json({ message: 'User already exists', user });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

