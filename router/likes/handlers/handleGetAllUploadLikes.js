const { PhotoLikes, User } = require('../../../models');

const handleGetAllUploadLikes = async (req, res) => {
  try {
    const photoLikes = await PhotoLikes.findAll({
      where: {
        photoId: req.params.photoId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
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
