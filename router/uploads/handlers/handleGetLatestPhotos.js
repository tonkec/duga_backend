const { Upload, User } = require('../../../models');
const addSecureUrlsToList =
  require('../../../utils/secureUploadUrl').addSecureUrlsToList;
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const { Op } = require('sequelize');

const handleGetLatestPhotos = async (req, res) => {
  try {
    const env = process.env.NODE_ENV || 'development';

    const uploads = await Upload.findAll({
      where: {
        url: {
          [Op.like]: `${env}/user/%`,
        },
      },
      include: [
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
      limit: 3,
      order: [['createdAt', 'DESC']],
    });

    const result = addSecureUrlsToList(
      uploads,
      API_BASE_URL,
      'url',
      'securePhotoUrl',
      getBearerToken(req)
    );
    return res.status(200).json(result);
  } catch (e) {
    console.error('❌ Error fetching latest uploads:', e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports = handleGetLatestPhotos;
