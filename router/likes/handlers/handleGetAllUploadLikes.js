const { PhotoLikes, User } = require('../../../models');
const { hasUploadAccess } = require('../../../utils/uploadAccess');

const handleGetAllUploadLikes = async (req, res) => {
  try {
    if (!(await hasUploadAccess(req.auth.user.id, req.params.photoId))) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.params.photoId,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    });

    return res.status(200).send(photoLikes);
  } catch (error) {
    console.error('❌ Error fetching photo likes:', error);
    return res.status(500).send({
      message: 'Error occurred while retrieving photo likes',
    });
  }
};

module.exports = handleGetAllUploadLikes;
