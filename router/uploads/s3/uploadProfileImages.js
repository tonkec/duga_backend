const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const allowedMimeTypes = require("../../../consts/allowedFileTypes");
const LIMIT_FILE_SIZE = require("../../../consts/limitFileSize");

const uploadProfileImages = (s3) => {
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
    limits: { fileSize: LIMIT_FILE_SIZE},
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.'));
      }
    },
  });
};

module.exports = uploadProfileImages;