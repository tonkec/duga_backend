require('dotenv').config();
const Upload = require('../models').Upload;
const { auth } = require('../middleware/auth');
const router = require('express').Router();
const upload = require('../controllers/uploadsController').upload;
const getImages = require('../controllers/uploadsController').getImages;
const AWS = require('aws-sdk');
const MAX_NUMBER_OF_FILES = 5;

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

router.post('/delete-avatar/', [auth], async (req, res) => {
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
      if (object.Key === req.body.item.url) {
        return true;
      }
      const thumbnail = req.body.item.url
        .substring(0, req.body.item.url.lastIndexOf('/') + 1)
        .concat(
          'thumbnail-',
          req.body.item.url.substring(req.body.item.url.lastIndexOf('/') + 1)
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

    // remove image from Uploads table
    await Upload.destroy({
      where: {
        url: req.body.item.url,
      },
    });

    return res.status(200).json({ message: 'Avatar deleted' });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.post(
  '/avatar',
  [auth, upload(s3).array('avatar', MAX_NUMBER_OF_FILES)],
  async function (req, res, next) {
    const text = JSON.parse(req.body.text);

    try {
      req.files.forEach(async (file, index) => {
        const originalName = file.transforms[1].key.substring(
          file.transforms[1].key.lastIndexOf('/') + 1
        );

        if (text[index].imageId === originalName) {
          await Upload.create({
            name: originalName,
            url: file.transforms[1].key,
            description: text[index].description,
          });
        }
      });
      return res.status(200).json({ message: 'Upload successful' });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

router.get('/avatar/:id', [auth], getImages);

module.exports = router;
