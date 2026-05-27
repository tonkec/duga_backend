const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const allowedMimeTypes = require('../../../consts/allowedFileTypes');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');
const { BUCKET } = require('./rekognitionConfiguration');

const getAuthenticatedUserId = (req) => req.auth?.user?.id || req.user?.id;

const buildProfileImageKey = (req, file, filenamePrefix = '') => {
  const authenticatedUserId = getAuthenticatedUserId(req);

  if (!authenticatedUserId) {
    throw new Error('Missing authenticated user ID');
  }

  if (
    req.body?.userId &&
    String(req.body.userId) !== String(authenticatedUserId)
  ) {
    throw new Error('Profile upload userId does not match authenticated user');
  }

  const safeFilename = path.basename(file.originalname);

  return `${process.env.NODE_ENV}/user/${authenticatedUserId}/${Date.now().toString()}/${filenamePrefix}${safeFilename}`;
};

const uploadProfileImages = (s3) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LIMIT_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error('Invalid file type. Only PNG, JPG, and JPEG are allowed.')
        );
      }
    },
  });

  const processAndUpload = async (req, res, next) => {
    try {
      if (!req.files?.length) return next();

      for (const file of req.files) {
        const originalKey = buildProfileImageKey(req, file);
        const thumbnailKey = buildProfileImageKey(req, file, 'thumbnail-');
        const original = await sharp(file.buffer).resize(600, 600).toBuffer();
        const thumbnail = await sharp(file.buffer).resize(100, 100).toBuffer();

        await Promise.all([
          s3
            .putObject({
              Bucket: BUCKET,
              Key: originalKey,
              Body: original,
              ContentType: file.mimetype,
              ACL: 'private',
            })
            .promise(),
          s3
            .putObject({
              Bucket: BUCKET,
              Key: thumbnailKey,
              Body: thumbnail,
              ContentType: file.mimetype,
              ACL: 'private',
            })
            .promise(),
        ]);

        file.transforms = [
          { id: 'original', key: originalKey },
          { id: 'thumbnail', key: thumbnailKey },
        ];
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

  return {
    array: (fieldName, maxCount) => {
      const memoryMiddleware = upload.array(fieldName, maxCount);
      return (req, res, next) => {
        memoryMiddleware(req, res, (error) => {
          if (error) return next(error);
          return processAndUpload(req, res, next);
        });
      };
    },
  };
};

module.exports = uploadProfileImages;
module.exports.buildProfileImageKey = buildProfileImageKey;
