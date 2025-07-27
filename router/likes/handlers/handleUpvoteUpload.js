const { PhotoLikes } = require('../../../models');

const handleUpvoteUpload = async (req, res) => {
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
};

module.exports = handleUpvoteUpload;
