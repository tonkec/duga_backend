const Upload = require('../../../models').Upload;
const addSecureUrlsToList = require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const { API_BASE_URL } = require("../../../consts/apiBaseUrl");

const handleGetProfilePhoto = async (req, res) => {
  const { id } = req.params;

  try {
    const upload = await Upload.findOne({
      where: {
        userId: id,
        isProfilePhoto: true,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!upload) {
      return res.json({ securePhotoUrl: null });
    }

    const [secureUpload] = addSecureUrlsToList([upload], API_BASE_URL, 'url');
    return res.json({ securePhotoUrl: secureUpload.securePhotoUrl });
  } catch (error) {
    console.error('Error fetching profile photo:', error);
    return res.status(500).json({ error: 'Failed to fetch profile photo' });
  }
};

module.exports = handleGetProfilePhoto;
