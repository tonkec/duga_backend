const Upload = require('../models').Upload;
const { checkJwt } = require('../middleware/auth');
const PhotoLikes = require('../models').PhotoLikes;
const router = require('express').Router();

router.post('/upvote', [checkJwt], async (req, res) => {
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.body.uploadId,
      },
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    const photoLike = await PhotoLikes.findOne({
      where: {
        userId: req.body.userId,
        photoId: req.body.uploadId,
      },
    });

    if (photoLike) {
      return res.status(400).send({
        message: 'You already liked this photo',
      });
    }

    await PhotoLikes.create({
      userId: req.body.userId,
      photoId: req.body.uploadId,
    });

    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.body.uploadId,
      },
    });

    return res.status(201).send(photoLikes);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while liking photo',
    });
  }
});

router.post('/downvote', [checkJwt], async (req, res) => {
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.body.uploadId,
      },
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    const photoLike = await PhotoLikes.findOne({
      where: {
        userId: req.body.userId,
        photoId: req.body.uploadId,
      },
    });

    if (!photoLike) {
      return res.status(400).send({
        message: 'You have not liked this photo',
      });
    }

    await photoLike.destroy();

    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.body.uploadId,
      },
    });

    return res.status(200).send(photoLikes);
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      message: 'Error occurred while unliking photo',
    });
  }
});

router.get('/all-likes/:photoId', [checkJwt], async (req, res) => {
  try {
    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.params.photoId,
      },
    });

    return res.status(200).send(photoLikes);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while retrieving photo likes',
    });
  }
});

module.exports = router;
