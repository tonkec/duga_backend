require('dotenv').config();
const Upload = require('../models').Upload;
const PhotoComment = require('../models').PhotoComment;
const Message = require('../models').Message;
const { checkJwt } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = require('express').Router();
const User = require('../models').User;
const uploadMultiple = require('../controllers/uploadsController').uploadMultiple;
const uploadMessageImage = require('../controllers/uploadsController').uploadMessageImage;
const getImages = require('../controllers/uploadsController').getImages;
const AWS = require('aws-sdk');
const attachCurrentUser = require('../middleware/attachCurrentUser');
const MAX_NUMBER_OF_FILES = 5;
const withAccessCheck = require('../middleware/accessCheck');

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

router.delete('/delete-photo',  [
    checkJwt,
    withAccessCheck(Upload, async (req) => {
      const { url } = req.body;
      if (!url) return null;
      return await Upload.findOne({ where: { url } });
    }),
  ], async (req, res) => {
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
  "/message-photos",
  [checkJwt, uploadMessageImage(s3).array('avatars', MAX_NUMBER_OF_FILES)],
  async (req, res) => {
    try {
      return res.status(200).json({ message: 'Upload successful' });
    } catch (error) {
      if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Something went wrong' });
    }
  }
);

router.post(
  '/photos',
  [
    checkJwt,
    attachCurrentUser,
    withAccessCheck(User, async (req) => {
      const userId = req.auth.user.id;
      return await User.findOne({ where: { id: userId, auth0Id: req.auth.sub } });
    }),
    uploadMultiple(s3).array('avatars', MAX_NUMBER_OF_FILES),
  ],
  async function (req, res) {
    try {
      const descriptions = JSON.parse(req.body.text);

      if (req.files.length) {
        await Promise.all(
          req.files.map(async (file) => {
            const match = descriptions.find(
              (d) => d.imageId === removeSpacesAndDashes(file.originalname)
            );
            await Upload.create({
              name: removeSpacesAndDashes(file.originalname),
              url: file.transforms[1].key,
              description: match?.description || null,
              userId: req.user.id,
            });
          })
        );
      } else {
        await Upload.update(
          { isProfilePhoto: false },
          { where: { userId: req.user.id } }
        );

        await Promise.all(
          descriptions.map(async (description) => {
            const [rowsUpdated] = await Upload.update(
              {
                description: description.description,
                isProfilePhoto: description.isProfilePhoto,
              },
              {
                where: {
                  name: removeSpacesAndDashes(description.imageId),
                  userId: req.user.id,
                },
              }
            );
            if (rowsUpdated === 0) {
              console.warn('No records updated');
            }
          })
        );
      }

      return res.status(200).json({ message: 'Upload successful' });
    } catch (e) {
      console.error('Upload error:', e);
      return res.status(500).json({ message: e.message });
    }
  }
);


router.get('/user/:id', [checkJwt], getImages);

router.get("/photo/:id", [checkJwt], async (req, res) => { 
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

router.get("/latest", [checkJwt], async (req, res) => {
  try {
    const uploads = await Upload.findAll({
      limit: 3,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(uploads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
router.get("/user-photos", [checkJwt, attachCurrentUser], async (req, res) => {
  try {
    const userId = req.auth.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const uploads = await Upload.findAll({
      where: {
        userId,
      },
    });

    const photoComments = await PhotoComment.findAll({
      where: {
        userId,
        imageUrl: {
          [Op.ne]: null,
        },
      },
    });


    const chatPhotos = await Message.findAll({
      where: {
        fromUserId: userId,
        messagePhotoUrl: {
          [Op.ne]: null,
        },
      },
    });

    if (chatPhotos) {
      uploads.push(...chatPhotos);
    }
  
    if (photoComments) {
      uploads.push(...photoComments);
    }

    uploads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).send(uploads);
  } catch (error) {
    console.error('Error fetching user photos:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching user photos',
    });
  }
});

module.exports = router;
