const { PhotoComment, User } = require('../../../models');
const { addSecureUrlsToList } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');

const handleGetLatestComments = async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
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
