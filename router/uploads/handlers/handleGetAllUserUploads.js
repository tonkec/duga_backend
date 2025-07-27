const { Upload } = require('../../../models');
const s3 = require('../../../utils/s3'); 
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');

const API_BASE_URL = process.env.API_BASE_URL;

const handleGetAllUserUploads = async (req, res) => {
  try {
    const userId = req.params.id;

    const params = {
      Bucket: 'duga-user-photo',
      Prefix: `${process.env.NODE_ENV}/user/${userId}/`,
    };

    const uploads = await Upload.findAll({ where: { userId } });
    const data = await s3.listObjectsV2(params).promise();
    const s3Keys = data.Contents.map((obj) => obj.Key);

    const result = uploads
      .filter((upload) => s3Keys.includes(upload.url))
      .map((upload) => {
        const plain = upload.toJSON();
        const securePhotoUrl = attachSecureUrl(API_BASE_URL, plain.url);
        return { ...plain, securePhotoUrl };
      });

    return res.status(200).json({ images: result });
  } catch (e) {
    console.error('❌ Error in /uploads/user/:id:', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = handleGetAllUserUploads;
