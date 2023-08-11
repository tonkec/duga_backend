const { auth } = require('../middleware/auth');
const router = require('express').Router();
require('dotenv').config();
const { S3Client, ListObjectsCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

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
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
      return callback(new Error('Only images are allowed'));
    }
    callback(null, true);
  },
  storage: multerS3({
    s3: s3,
    bucket: 'duga-user-photo',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      cb(null, `user/${req.user.id}/${Date.now().toString()}`);
    },
  }),
});

const getImages = async (req, res) => {
  try {
    const data = await s3.send(
      new ListObjectsCommand({
        Bucket: 'duga-user-photo',
        Prefix: `user/${req.user.id}`,
      })
    );
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

router.post(
  '/avatar',
  [auth, upload.array('avatar', 1)],
  function (req, res, next) {
    try {
      return res.send('Successfully uploaded ' + req.files.length + ' files!');
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

router.get('/avatar/:id', [auth], getImages);

module.exports = router;
