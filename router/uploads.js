require('dotenv').config();
const Upload = require('../models').Upload;
const User = require('../models').User;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const withAccessCheck = require('../middleware/accessCheck');
const handleDeletePhotoRequest = require("./uploads/handlers/handleDeletePhotoRequest");
const handleGetPhotoById = require("./uploads/handlers/handleGetPhotoById");
const handleGetProfilePhoto = require('./uploads/handlers/handleGetProfilePhoto');
const handleGetLatestPhotos = require('./uploads/handlers/handleGetLatestPhotos');
const handleMessagePhotoUpload = require('./uploads/handlers/handleMessagePhotoUpload');
const uploadMessageImage = require("./uploads/s3/uploadMessageImage");
const handleProfilePhotosUpload = require('./uploads/handlers/handleProfilePhotosUpload');
const uploadProfileImages = require('./uploads/s3/uploadProfileImages');
const handleGetUserPhotos = require('./uploads/handlers/handleGetUserPhotos');
const attachCurrentUser = require("./../middleware/attachCurrentUser");
const handleStreamS3FileRequest = require('./uploads/handlers/handleStreamS3FileRequest');
const s3 = require("./../utils/s3");
const MAX_NUMBER_OF_FILES = require("../consts/maxNumberOfFiles");
const handleGetAllUserUploads = require('./uploads/handlers/handleGetAllUserUploads');
const LIMIT_FILE_SIZE = require('../consts/limitFileSize');
const uploadStack = uploadMessageImage(s3); // could be array or single fn

function runUploadStack(stack) {
  const mws = Array.isArray(stack) ? stack : [stack];

  return (req, res, next) => {
    let i = 0;

    const step = (err) => {
      if (err) return handleMulterError(err, req, res, next);
      const mw = mws[i++];
      if (!mw) return next();          // all good, proceed
      try {
        mw(req, res, step);            // run next upload middleware
      } catch (e) {
        handleMulterError(e, req, res, next);
      }
    };

    step();
  };
}

function handleMulterError(err, req, res, next) {
  // Known Multer error codes:
  // LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, LIMIT_FIELD_COUNT,
  // LIMIT_UNEXPECTED_FILE, LIMIT_PART_COUNT, LIMIT_FIELD_KEY, LIMIT_FIELD_VALUE
  if (err.code === 'LIMIT_FILE_SIZE') {
     return res.status(413).json({errors: [{ reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.` }] });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({errors: [{ reason: `Previše datoteka` }] });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(413).json({errors: [{ reason: `Nepodržan format` }] });
  }

  if (err.message) {
    return res.status(400).json({ message: err.message });
  }

  return next(err);
}

require('./uploads/swagger/deletePhoto.swagger');
router.delete('/delete-photo', [
  checkJwt,
  withAccessCheck(Upload, async (req) => {
    const { url } = req.body;
    if (!url) return null;
    return await Upload.findOne({ where: { url } });
  }),
], handleDeletePhotoRequest);

require('./uploads/swagger/getPhotoById.swagger');
router.get("/photo/:id", [checkJwt], handleGetPhotoById);

require('./uploads/swagger/getProfilePhoto.swagger');
router.get("/profile-photo/:id", [checkJwt], handleGetProfilePhoto);

require('./uploads/swagger/getLatestPhotos.swagger');
router.get('/latest', [checkJwt], handleGetLatestPhotos);

require('./uploads/swagger/uploadMessagePhotos.swagger');
router.post(
  '/message-photos',
  [checkJwt, attachCurrentUser, runUploadStack(uploadStack)],
  handleMessagePhotoUpload
);
require('./uploads/swagger/uploadProfilePhotos.swagger');
const upload = uploadProfileImages(s3).array('avatars', MAX_NUMBER_OF_FILES);

router.post(
  '/photos',
  [
    checkJwt,
    attachCurrentUser,
    withAccessCheck(User, async (req) => {
      const userId = req.auth.user.id;
      return await User.findOne({ where: { id: userId, auth0Id: req.auth.sub } });
    }),
    (req, res, next) => {
      upload(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({errors: [{ reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.` }] });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(413).json({errors: [{ reason: `Nepodržan format` }] });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({errors: [{ reason: `Maksimalan broj datoteka je ${MAX_NUMBER_OF_FILES}.` }] });
        }

        return res.status(400).json({ message: err.message || 'Upload error.' });
      });
    },
  ],
  handleProfilePhotosUpload
);

require('./uploads/swagger/getUserPhotos.swagger');
router.get('/user-photos', [checkJwt, attachCurrentUser], handleGetUserPhotos);

require('./uploads/swagger/files.swagger');
router.get('/files/*', checkJwt, handleStreamS3FileRequest);

require('./uploads/swagger/getAllUserUploads.swagger');
router.get('/user/:id', [checkJwt], handleGetAllUserUploads);

module.exports = router;
