const { Notification, PhotoLikes } = require('../../../models');
const { findAccessibleUploadById } = require('../../../utils/uploadAccess');

const isUniqueLikeConstraintError = (error) =>
  error?.name === 'SequelizeUniqueConstraintError';

const handleUpvoteUpload = async (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    const userId = req.auth.user.id;
    const upload = await findAccessibleUploadById(userId, uploadId);

    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    const likeWhere = {
      userId,
      photoId: uploadId,
    };

    const getPhotoLikes = () =>
      PhotoLikes.findAll({
        where: {
          photoId: uploadId,
        },
      });

    const photoLike = await PhotoLikes.findOne({
      where: likeWhere,
    });

    if (photoLike) {
      const photoLikes = await getPhotoLikes();
      return res.status(200).json(photoLikes);
    }

    try {
      await PhotoLikes.create({
        userId,
        photoId: uploadId,
      });
    } catch (error) {
      if (isUniqueLikeConstraintError(error)) {
        const photoLikes = await getPhotoLikes();
        return res.status(200).json(photoLikes);
      }

      throw error;
    }

    if (upload?.userId && Number(upload.userId) !== Number(userId)) {
      await Notification.create({
        userId: upload.userId,
        type: 'like',
        content: 'Netko je lajkao tvoju fotografiju.',
        actionId: uploadId,
        actionType: 'upload',
      });
    }

    const photoLikes = await getPhotoLikes();

    req.app.get('io').emit('upvote-upload', {
      uploadId,
      likes: photoLikes,
    });

    return res.status(201).json(photoLikes);
  } catch (error) {
    console.error('❌ Error upvoting:', error);
    return res
      .status(500)
      .json({ message: 'Error occurred while liking photo' });
  }
};

module.exports = handleUpvoteUpload;
