const { PhotoComment, Upload, User } = require('../../../models');
const { addSecureUrlsToList } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const { buildUploadAccessWhere } = require('../../../utils/uploadAccess');

const handleGetLatestComments = async (req, res) => {
  try {
    const uploadAccessWhere = await buildUploadAccessWhere(req.auth.user.id);

    const photoComments = await PhotoComment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Upload,
          as: 'upload',
          attributes: [],
          where: uploadAccessWhere,
          required: true,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'publicId', 'username'],
        },
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
          through: { attributes: [] },
        },
      ],
    });

    const commentsWithSecureUrls = addSecureUrlsToList(
      photoComments,
      API_BASE_URL,
      'imageUrl',
      'securePhotoUrl',
      getBearerToken(req)
    );

    return res.status(200).json(commentsWithSecureUrls);
  } catch (error) {
    console.error('❌ Error in /comments/latest:', error);
    return res
      .status(500)
      .json({ message: 'Error occurred while fetching comments' });
  }
};

module.exports = handleGetLatestComments;
