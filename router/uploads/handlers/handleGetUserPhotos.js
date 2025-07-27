const Upload = require('../../../models').Upload;
const {API_BASE_URL} = require("../../../consts/apiBaseUrl");

const handleGetUserPhotos = async (req, res) => {
  try {
    const userId = req.auth?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const uploads = await Upload.findAll({
      where: { userId },
      attributes: ['id', 'url', 'description', 'createdAt'],
    });

    const allPhotos = uploads
      .map(upload => {
        const key = upload.url;
        return {
          ...upload.toJSON(),
          type: 'upload',
          originalField: 'url',
          securePhotoUrl: `${API_BASE_URL}/uploads/files/${encodeURIComponent(key)}`,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(allPhotos);
  } catch (error) {
    console.error('Error fetching user photos:', error);
    return res.status(500).json({
      message: 'Error occurred while fetching user photos',
    });
  }
};

module.exports = handleGetUserPhotos;
