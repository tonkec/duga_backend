const User = require("../models").User
const { checkJwt } = require('../middleware/auth');
const PhotoLikes = require('../models').PhotoLikes;
const router = require('express').Router();
const attachCurrentUser = require("../middleware/attachCurrentUser");

/**
 * @swagger
 * /likes/upvote/{id}:
 *   post:
 *     summary: Upvote (like) a photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the photo to like
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Photo liked successfully
 *       400:
 *         description: Already liked or invalid photo ID
 *       500:
 *         description: Server error
 */
router.post('/upvote/:id', [checkJwt, attachCurrentUser], async (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    const userId = req.auth.user.id;

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

     req.app.get('io').emit('upvote-upload', {
      uploadId,
      likes: photoLikes,
    });

    return res.status(201).json(photoLikes);
  } catch (error) {
    console.error('❌ Error upvoting:', error);
    return res.status(500).json({ message: 'Error occurred while liking photo' });
  }
});

/**
 * @swagger
 * /likes/downvote/{id}:
 *   post:
 *     summary: Downvote (unlike) a photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the photo to unlike
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Photo unliked successfully
 *       400:
 *         description: Not previously liked
 *       500:
 *         description: Server error
 */
router.post('/downvote/:id', [checkJwt, attachCurrentUser], async (req, res) => {
  const uploadId = parseInt(req.params.id);
  const userId = req.auth.user.id;

  if (!uploadId) {
    return res.status(400).json({ message: 'Missing uploadId' });
  }

  try {
    const photoLike = await PhotoLikes.findOne({
      where: { userId, photoId: uploadId },
    });

    if (!photoLike) {
      return res.status(400).json({ message: 'You have not liked this photo' });
    }

    await photoLike.destroy();

    const updatedLikes = await PhotoLikes.findAll({
      where: { photoId: uploadId },
    });

    req.app.get('io').emit('downvote-upload', {
      uploadId,
      likes: updatedLikes,
    });

    return res.status(200).json({ uploadId });
  } catch (error) {
    console.error('❌ Error in /downvote:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /likes/all-likes/{photoId}:
 *   get:
 *     summary: Get all likes for a specific photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: photoId
 *         in: path
 *         required: true
 *         description: ID of the photo
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users who liked the photo
 *       500:
 *         description: Server error
 */
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
