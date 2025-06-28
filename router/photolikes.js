const Upload = require('../models').Upload;
const User = require("../models").User
const { checkJwt } = require('../middleware/auth');
const PhotoLikes = require('../models').PhotoLikes;
const router = require('express').Router();
const attachCurrentUser = require("../middleware/attachCurrentUser");

router.post('/upvote/:id', [checkJwt, attachCurrentUser], async (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    const userId = req.auth.user.id;

    console.log(userId)

    const photoLike = await PhotoLikes.findOne({
      where: {
        userId,
        photoId: uploadId,
      },
    });

    if (photoLike) {
      return res.status(400).json({ message: 'You already liked this photo' });
    }
    await PhotoLikes.create({
      userId,
      photoId: uploadId,
    });

    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: uploadId,
      },
    });

    return res.status(201).json(photoLikes);
  } catch (error) {
    console.error('❌ Error upvoting:', error);
    return res.status(500).json({ message: 'Error occurred while liking photo' });
  }
});


router.post('/downvote/:id', [checkJwt, attachCurrentUser], async (req, res) => {
  console.log("api post")
  const uploadId  = parseInt(req.params.id);
  const userId = req.auth.user.id;

  if (!uploadId) {
    return res.status(400).json({ message: 'Missing uploadId in request body' });
  }

  try {
    const upload = await Upload.findByPk(uploadId);
    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    const photoLike = await PhotoLikes.findOne({
      where: { userId, photoId: uploadId },
    });

    if (!photoLike) {
      return res.status(400).json({ message: 'You have not liked this photo' });
    }

    return res.status(200).json({uploadId});
  } catch (error) {
    console.error('❌ Error in /downvote:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/all-likes/:photoId', [checkJwt], async (req, res) => {
  try {
    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.params.photoId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", 'username'],
        },
      ],
    });
    return res.status(200).send(photoLikes);
  } catch (error) {
    console.log(error)
    return res.status(500).send({
      message: 'Error occurred while retrieving photo likes',
    });
  }
});

module.exports = router;
