const Upload = require('../models').Upload;
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');

const sharp = require('sharp');

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

exports.getAllUploads = async (req, res) => {
  try {
    const uploads = await Upload.findAll();
    return res.json(uploads);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.upload = (s3) => {
  return multer({
    storage: multerS3({
      s3: s3,
      bucket: 'duga-user-photo',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      shouldTransform: function (req, file, cb) {
        cb(null, /^image/i.test(file.mimetype));
      },
      transforms: [
        {
          id: 'original',
          key: function (req, file, cb) {
            cb(
              null,
              `user/${req.user.id}/${Date.now().toString()}/${
                file.originalname
              }`
            );
          },
          transform: function (req, file, cb) {
            cb(null, sharp().resize(600, 600));
          },
        },
        {
          id: 'thumbnail',
          key: function (req, file, cb) {
            cb(
              null,
              `user/${
                req.user.id
              }/${Date.now().toString()}/${`thumbnail-${file.originalname}`}`
            );
          },
          transform: function (req, file, cb) {
            cb(null, sharp().resize(100, 100));
          },
        },
      ],
    }),
  });
};

exports.getImages = async (req, res) => {
  const params = {
    Bucket: 'duga-user-photo',
    Prefix: `user/${req.params.id}/`,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const contents = data.Contents;

    return res.status(200).json(contents);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
