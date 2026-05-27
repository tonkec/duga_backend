const { Upload, User } = require('../../../models');
const s3 = require('../../../utils/s3');
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const { buildUploadAccessWhere } = require('../../../utils/uploadAccess');

const handleGetAllUserUploads = async (req, res) => {
  try {
    const userId = req.params.id;

    const params = {
      Bucket: 'duga-user-photo',
      Prefix: `${process.env.NODE_ENV}/user/${userId}/`,
    };

    const uploads = await Upload.findAll({
      where: await buildUploadAccessWhere(req.auth.user.id, { userId }),
      include: [
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    });
    const data = await s3.listObjectsV2(params).promise();
    const s3Keys = data.Contents.map((obj) => obj.Key);

    const result = uploads
      .filter((upload) => s3Keys.includes(upload.url))
      .map((upload) => {
        const plain = upload.toJSON();
        const securePhotoUrl = attachSecureUrl(
          API_BASE_URL,
          plain.url,
          getBearerToken(req)
        );
        return { ...plain, securePhotoUrl };
      });

    return res.status(200).json({ images: result });
  } catch (e) {
    console.error('❌ Error in /uploads/user/:id:', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = handleGetAllUserUploads;
