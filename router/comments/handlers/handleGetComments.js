const { PhotoComment, User } = require('../../../models');
const addSecureUrlsToList =
  require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const { findAccessibleUploadById } = require('../../../utils/uploadAccess');

const handleGetComments = async (req, res) => {
  try {
    const uploadId = req.params.uploadId;
    const upload = await findAccessibleUploadById(req.auth.user.id, uploadId, {
      attributes: ['id'],
    });

    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    const limit = Number.parseInt(req.query.limit, 10);
    const page = Number.parseInt(req.query.page, 10);
    const hasPagination = Number.isInteger(limit) && limit > 0;
    const sortDirection = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

    const queryOptions = {
      where: { uploadId: req.params.uploadId },
      order: [['createdAt', sortDirection]],
      include: [
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    };

    if (hasPagination) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      queryOptions.limit = limit;
      queryOptions.offset = (safePage - 1) * limit;
    }

    const photoComments = await PhotoComment.findAll(queryOptions);

    const commentsWithSecureUrls = addSecureUrlsToList(
      photoComments,
      API_BASE_URL,
      'imageUrl',
      'securePhotoUrl',
      getBearerToken(req)
    );
    return res.status(200).send(commentsWithSecureUrls);
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
};

module.exports = handleGetComments;
