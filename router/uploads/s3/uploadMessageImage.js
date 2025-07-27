const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const removeSpacesAndDashes  = require("../../../utils/removeSpacesAndDashes");

const uploadMessageImage = (s3) => {
  return multer({
    storage: multerS3({
      s3,
      bucket: 'duga-user-photo',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      shouldTransform(req, file, cb) {
        cb(null, /^image/i.test(file.mimetype));
      },
      transforms: [
        {
          id: 'original',
          key(req, file, cb) {
            const body = JSON.parse(JSON.stringify(req.body));
            const cleanedName = removeSpacesAndDashes(file.originalname).toLowerCase();
            cb(
              null,
              `${process.env.NODE_ENV}/chat/${body.chatId}/${body.timestamp}/${cleanedName}`
            );
          },
          transform(req, file, cb) {
            cb(null, sharp().resize(1200, 1200));
          },
        },
      ],
    }),
    fileFilter(req, file, cb) {
      if (
        ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.mimetype)
      ) {
        cb(null, true);
      } else {
        const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
      }
    },
  });
};

module.exports = uploadMessageImage;