const UserFollower = require('../models').UserFollower;
const {checkJwt } = require('../middleware/auth');
const router = require('express').Router();

router.get('/:id', checkJwt, async (req, res) => {
  try {
    const followers = await UserFollower.findAll({
      where: {
        followerId: req.params.id,
      },
    });
    res.status(200).json({ followers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/add', checkJwt, async (req, res) => {
  try {
    // check if user is already following
    const isAlreadyFollowing = await UserFollower.findOne({
      where: {
        userId: req.user.id,
        followerId: req.body.followerId,
      },
    });

    if (isAlreadyFollowing) {
      return res.status(400).json({ error: 'Already following' });
    }

    const follower = await UserFollower.create({
      userId: req.user.id,
      followerId: req.body.followerId,
    });

    res.status(201).json({ follower });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/remove', checkJwt, async (req, res) => {
  try {
    const follower = await UserFollower.findOne({
      where: {
        userId: req.body.userId,
        followerId: req.body.followerId,
      },
    });

    if (!follower) {
      return res.status(404).json({ error: 'Follower not found' });
    }

    await follower.destroy();

    const followers = await UserFollower.findAll({
      where: {
        followerId: req.body.followerId,
      },
    });

    res.status(200).json({ followers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
