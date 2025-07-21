const Upload = require('../models').Upload;
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const allowedMimeTypes = require("../consts/allowedFileTypes")
const { attachSecureUrl } = require('../utils/secureUploadUrl');
const API_BASE_URL = `${process.env.APP_URL}:${process.env.APP_PORT}`;

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

exports.uploadMessageImage = s3 => {
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
            const body = JSON.parse(JSON.stringify(req.body));
            cb(
              null,
              `${process.env.NODE_ENV}/chat/${body.chatId}/${body.timestamp}/${
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
            const body = JSON.parse(JSON.stringify(req.body));
            cb(
              null,
              `${process.env.NODE_ENV}/chat/${
                body.chatId
              }/${body.timestamp}/${`thumbnail-${file.originalname}`}`
            );
          },
          transform: function (req, file, cb) {
            cb(null, sharp().resize(100, 100));
          },
        },
      ],
    }),
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
      }
    },
  });  
}

exports.uploadMultiple = (s3) => {
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
            if (!req.body.userId) {
              return cb(new Error('Missing user ID'));
            }
            cb(
              null,
              `${process.env.NODE_ENV}/user/${req.body.userId}/${Date.now().toString()}/${
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
            if (!req.body.userId) {
              return cb(new Error('Missing user ID'));
            }
            cb(
              null,
              `${process.env.NODE_ENV}/user/${
                req.body.userId
              }/${Date.now().toString()}/${`thumbnail-${file.originalname}`}`
            );
          },
          transform: function (req, file, cb) {
            cb(null, sharp().resize(100, 100));
          },
        },
      ],
    }),
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.'));
      }
    },
  });
};

exports.getImages = async (req, res) => {
  const userId = req.params.id;
  const params = {
    Bucket: 'duga-user-photo',
    Prefix: `${process.env.NODE_ENV}/user/${userId}/`,
  };

  try {
    const uploads = await Upload.findAll({ where: { userId } });
    const data = await s3.listObjectsV2(params).promise();

    const s3Keys = data.Contents.map((obj) => obj.Key);

    const filtered = uploads
      .filter((upload) => s3Keys.includes(upload.url))
      .map((upload) => {
        const plain = upload.toJSON();
        const securePhotoUrl = attachSecureUrl(API_BASE_URL, plain.url);
        return { ...plain, securePhotoUrl };
      });

    console.log(filtered)
    return res.status(200).json({ images: filtered });
  } catch (e) {
    console.error('❌ Error in getImages:', e);
    return res.status(500).json({ message: e.message });
  }
};
