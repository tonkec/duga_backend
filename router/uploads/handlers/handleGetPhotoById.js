const { Upload, User } = require('../../../models');
const addSecureUrlsToList =
  require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');

const handleGetPhotoById = async (req, res) => {
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.params.id,
      },
      include: [
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    const plainUpload = upload.toJSON();
    const secureUrl = addSecureUrlsToList(
      [plainUpload],
      API_BASE_URL,
      'url',
      'securePhotoUrl',
      getBearerToken(req)
    )[0].securePhotoUrl;

    return res.status(200).send({
      ...plainUpload,
      secureUrl,
    });
  } catch (error) {
    console.error('❌ Error fetching photo:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching photo',
    });
  }
};

module.exports = handleGetPhotoById;
