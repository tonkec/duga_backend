const User = require('../../../models').User;

const handleGetAllUsers = async (req, res) => {
  try {
   const users = await User.findAll({
      attributes: {
        exclude: ['auth0Id'], 
      },
    });
    return res.json(users);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetAllUsers;