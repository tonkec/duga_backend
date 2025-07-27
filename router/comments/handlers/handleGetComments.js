const { PhotoComment, User } = require('../../../models');
const addSecureUrlsToList = require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const { API_BASE_URL } = require("../../../consts/apiBaseUrl");

const handleGetComments = async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      where: { uploadId: req.params.uploadId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'username'],
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
        },
      ],
    });

    const commentsWithSecureUrls = addSecureUrlsToList(photoComments, API_BASE_URL, 'imageUrl');
    return res.status(200).send(commentsWithSecureUrls);
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
};

module.exports = handleGetComments;
