const User = require('../models').User;
const { Op } = require('sequelize');

exports.update = async (req, res) => {
  const userId = req.auth.user.id;

  try {
    const [rows, result] = await User.update(
      {
        firstName: req.body.data.firstName ? req.body.data.firstName : null,
        lastName: req.body.data.lastName ? req.body.data.lastName : null,
        username: req.body.data.username ? req.body.data.username : null,
        bio: req.body.data.bio ? req.body.data.bio : null,
        sexuality: req.body.data.sexuality ? req.body.data.sexuality : null,
        gender: req.body.data.gender ? req.body.data.gender : null,
        location: req.body.data.location ? req.body.data.location : null,
        age: req.body.data.age ? req.body.data.age : null,
        lookingFor: req.body.data.lookingFor ? req.body.data.lookingFor : null,
        relationshipStatus: req.body.data.relationshipStatus ? req.body.data.relationshipStatus : null,
        cigarettes: req.body.data.cigarettes ? req.body.data.cigarettes : null,
        alcohol: req.body.data.alcohol ? req.body.data.alcohol : null,
        sport: req.body.data.sport ? req.body.data.sport : null,
        favoriteDayOfWeek: req.body.data.favoriteDay ? req.body.data.favoriteDay : null,
        spirituality: req.body.data.spirituality ? req.body.data.spirituality : null,
        embarasement: req.body.data.embarasement ? req.body.data.embarasement : null,
        tooOldFor: req.body.data.tooOldFor ? req.body.data.tooOldFor : null,
        makesMyDay: req.body.data.makesMyDay ? req.body.data.makesMyDay : null,
        favoriteSong: req.body.data.favoriteSong ? req.body.data.favoriteSong : null,
        favoriteMovie: req.body.data.favoriteMovie ? req.body.data.favoriteMovie : null,
        interests: req.body.data.interests ? req.body.data.interests : null,
        languages: req.body.data.languages ? req.body.data.languages : null,
        ending: req.body.data.ending ? req.body.data.ending : null,
      },
      {
        where: {
          id: userId,
        },
        returning: true,
        individualHooks: true,
      }
    );

    const { auth0Id, ...user } = result[0].get({ raw: true });
    user.avatar = result[0].avatar;

    return res.send(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.getAllUsers = async (req, res) => {
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

exports.getUser = async (req, res) => {
  try {

    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['auth0Id'] },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};


exports.getUsersByUsername = async (req, res) => {
  try {
    const username = req.params.username;

    if (!username) {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    const users = await User.findAll({
      where: {
        username: {
          [Op.iLike]: `${username}%`, 
        },
      },
      attributes: ['id', 'username'], 
      limit: 10,
    });

    if (!users.length) {
      return res.status(404).json({ error: 'No users found' });
    }

    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};



exports.getUserOnlineStatus = async (req, res) => {
  try {
    const userId = req.auth.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID parameter' });
    }

    const user = await User.findByPk(userId, {
      attributes: ['status'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ status: user.status });
  } catch (e) {
    console.log(e)
    return res.status(500).json({ error: e.message });
  }
}