const multer = require('multer');
const allowedMimeTypes = require('./../../../consts/allowedFileTypes');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');

const uploadCommentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMIT_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        'Invalid file type. Only PNG, JPG, and JPEG are allowed.'
      );
      error.code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  },
});

module.exports = uploadCommentImage;
