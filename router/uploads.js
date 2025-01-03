require('dotenv').config();
const Upload = require('../models').Upload;
const { auth } = require('../middleware/auth');
const router = require('express').Router();
const uploadMultiple =
  require('../controllers/uploadsController').uploadMultiple;
const uploadSingle = require('../controllers/uploadsController').uploadSingle;
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

router.delete('/delete-photo', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Photo URL is required.' });
  }

  try {
    // Extract S3 Bucket Key from URL
    const bucketKey = url; // `url` contains the S3 key, e.g., "user/4/profile-photo/filename.jpg"

    // Delete photo from S3
    const params = {
      Bucket: 'duga-user-photo',
      Key: bucketKey, // The key extracted from `url`
    };

    await s3.deleteObject(params).promise();

    // Optionally, delete the photo record from the database
    const deletedPhoto = await Upload.destroy({
      where: { url },
    });

    if (!deletedPhoto) {
      return res.status(404).json({ error: 'Photo not found in the database.' });
    }

    res.status(200).json({ message: 'Photo deleted successfully.' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error });
  }
});

const removeSpacesAndDashes = (str) => {
  return str.replace(/[\s-]/g, '');
};

router.post(
  '/photos',
  [auth, uploadMultiple(s3).array('avatars', MAX_NUMBER_OF_FILES)],
  async function (req, res, next) {
    const descriptions = JSON.parse(req.body.text);
    try {
      if (req.files.length) {
        req.files.forEach(async (file) => {
          const findImageByDescription = descriptions.find(
            (description) => description.imageId === removeSpacesAndDashes(file.originalname)
          )
          await Upload.create({
            name: removeSpacesAndDashes(file.originalname),
            url: file.transforms[1].key,
            description: findImageByDescription?.description || null,
            userId: req.body.userId,
          });        
        });
      } else {
        descriptions.forEach(async (description) => {
          await Upload.update(
            { isProfilePhoto: false },
            { where: { userId: req.body.userId } }
          );

          const [rowsUpdated] = await Upload.update(
            { description: description.description, isProfilePhoto: description.isProfilePhoto },
            { 
              where: { 
                name: removeSpacesAndDashes(description.imageId),
                userId: req.body.userId 
              } 
            }
  );
        
          if (rowsUpdated === 0) {
            console.log('No records updated. Check your where clause.');
          } else {
            console.log(`Successfully updated ${rowsUpdated} record(s).`);
          }
        });
      }
     
      return res.status(200).json({ message: 'Upload successful' });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

router.get('/avatar/:id', [auth], getImages);

router.get("/photo/:id", [auth], async (req, res) => { 
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.params.id,
      },
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    return res.status(200).send(upload);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while fetching photo',
    });
  }
});

  
router.post(
  '/profile-photo',
  [auth],
  uploadSingle(s3).single('photo'),
  async function (req, res, next) {
    try {
      const originalName = req.file.transforms[0].key.substring(
        req.file.transforms[0].key.lastIndexOf('/') + 1
      );

      // Delete all other profile photos from database
      await Upload.destroy({
        where: {
          isProfilePhoto: true,
          userId: req.body.userId,
        },
        except: {
          where: {
            url: req.file.transforms[0].key,
            userId: req.body.userId,
          },
        },
      });

      await Upload.create({
        name: originalName,
        url: req.file.transforms[0].key,
        description: 'Profile photo',
        isProfilePhoto: true,
        userId: req.body.userId,
      });

      //delete all other profile photos from s3
      const params = {
        Bucket: 'duga-user-photo',
        Prefix: `user/${req.user.id}/profile-photo`,
      };

      const data = await s3.listObjectsV2(params).promise();
      const contents = data.Contents;
      // delete all images in the profile photo folder except the one just uploaded
      const objects = contents.map((content) => {
        return { Key: content.Key };
      });

      const filteredObjects = objects.filter((object) => {
        if (object.Key === req.file.transforms[0].key) {
          return false;
        }

        return true;
      });

      if (filteredObjects.length > 0) {
        const deleteParams = {
          Bucket: 'duga-user-photo',
          Delete: {
            Objects: filteredObjects,
          },
        };

        await s3.deleteObjects(deleteParams).promise();
      }

      return res.status(200).json({ message: 'Upload successful' });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

module.exports = router;
