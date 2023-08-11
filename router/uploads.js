const { auth } = require('../middleware/auth');
const router = require('express').Router();
require('dotenv').config();
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

let s3 = new S3Client({
  region: 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
  sslEnabled: false,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

const upload = multer({
  limits: { fileSize: 500000 },
  storage: multerS3({
    s3: s3,
    bucket: 'duga-user-photo',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      cb(null, `user/${req.user.id}/${Date.now().toString()}`);
    },
  }),
});
router.post(
  '/avatar',
  [auth, upload.array('avatar', 3)],
  function (req, res, next) {
    try {
      return res.send('Successfully uploaded ' + req.files.length + ' files!');
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

module.exports = router;
