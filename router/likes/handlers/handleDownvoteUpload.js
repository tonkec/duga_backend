const { PhotoLikes } = require('../../../models');

const handleDownvoteUpload = async (req, res) => {
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
};

module.exports = handleDownvoteUpload;
