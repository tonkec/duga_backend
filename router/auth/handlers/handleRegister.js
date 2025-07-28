
const { User } = require('../../../models');

const handleRegister = async (req, res) => {
  const { auth0Id, email, username } = req.body;

  if (!auth0Id || !email || !username) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ where: { email: normalizedEmail } });

    if (user) {
      if (!user.auth0Id) {
        await user.update({ auth0Id });
      }

      return res.status(200).json({ message: 'User already exists', user });
    }

    user = await User.create({
      auth0Id,
      email: normalizedEmail,
      username, 
    });

    console.log('User created');
    return res.status(201).json({ message: 'User created', user });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};


module.exports = handleRegister;