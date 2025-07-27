const Upload = require('../../../models').Upload;
const addSecureUrlsToList = require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const { API_BASE_URL } = require("../../../consts/apiBaseUrl");

const handleGetLatestPhotos = async (req, res) => {
  try {
    const uploads = await Upload.findAll({
      limit: 3,
      order: [['createdAt', 'DESC']],
    });

    const result = addSecureUrlsToList(uploads, API_BASE_URL);
    return res.status(200).json(result);
  } catch (e) {
    console.error('❌ Error fetching latest uploads:', e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports = handleGetLatestPhotos;
