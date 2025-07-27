const Upload = require('../../../models').Upload;
const addSecureUrlsToList = require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const { API_BASE_URL } = require("../../../consts/apiBaseUrl");

const handleGetPhotoById = async (req, res) => {
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.params.id,
      },
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    const plainUpload = upload.toJSON();
    const secureUrl = addSecureUrlsToList([plainUpload], API_BASE_URL)[0].securePhotoUrl;

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