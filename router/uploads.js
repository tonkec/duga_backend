const { auth } = require('../middleware/auth');
const router = require('express').Router();
require('dotenv').config();
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');

const sharp = require('sharp');

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

const upload = (s3) =>
  multer({
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

const getImages = async (req, res) => {
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

router.post('/delete-avatar/', [auth], async (req, res) => {
  // delete user folder by user id and timestamp from Key
  const params = {
    Bucket: 'duga-user-photo',
    Prefix: `user/${req.user.id}/`,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const contents = data.Contents;

    const objects = contents.map((content) => {
      return { Key: content.Key };
    });

    const filteredObjects = objects.filter((object) => {
      if (object.Key === req.body.item.Key) {
        return true;
      }
      const thumbnail = req.body.item.Key.substring(
        0,
        req.body.item.Key.lastIndexOf('/') + 1
      ).concat(
        'thumbnail-',
        req.body.item.Key.substring(req.body.item.Key.lastIndexOf('/') + 1)
      );

      if (object.Key === thumbnail) {
        return true;
      }

      return false;
    });

    const deleteParams = {
      Bucket: 'duga-user-photo',
      Delete: {
        Objects: filteredObjects,
      },
    };

    await s3.deleteObjects(deleteParams).promise();

    return res.status(200).json({ message: 'Avatar deleted' });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.post(
  '/avatar',
  [auth, upload(s3).array('avatar', 1)],
  function (req, res, next) {
    try {
      return res.send(res.req.files);
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

router.get('/avatar/:id', [auth], getImages);

module.exports = router;
