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
  [
    checkJwt,
    attachCurrentUser,
    uploadMessageImage(s3).array('avatars', MAX_NUMBER_OF_FILES),
  ],
  handleMessagePhotoUpload
);

require('./uploads/swagger/uploadProfilePhotos.swagger');
router.post(
  '/photos',
  [
    checkJwt,
    attachCurrentUser,
    withAccessCheck(User, async (req) => {
      const userId = req.auth.user.id;
      return await User.findOne({ where: { id: userId, auth0Id: req.auth.sub } });
    }),
    uploadProfileImages(s3).array('avatars', MAX_NUMBER_OF_FILES),
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
