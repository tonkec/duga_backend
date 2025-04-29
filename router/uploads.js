require('dotenv').config();
const Upload = require('../models').Upload;
const PhotoComment = require('../models').PhotoComment;
const Message = require('../models').Message;
const { checkJwt } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = require('express').Router();
const uploadMultiple = require('../controllers/uploadsController').uploadMultiple;
const uploadMessageImage = require('../controllers/uploadsController').uploadMessageImage;
const getImages = require('../controllers/uploadsController').getImages;
const AWS = require('aws-sdk');
const MAX_NUMBER_OF_FILES = 5;

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

router.delete('/delete-photo', [checkJwt], async (req, res) => {
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

router.post("/message-photos", [checkJwt, uploadMessageImage(s3).array('avatars', MAX_NUMBER_OF_FILES)], async (req, res) => {  
  return res.status(200).json({ message: 'Upload successful' });
}
);

router.post(
  '/photos',
  [checkJwt, uploadMultiple(s3).array('avatars', MAX_NUMBER_OF_FILES)],
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
router.get("/user-photos/:id", [checkJwt], async (req, res) => {
  try {
    const uploads = await Upload.findAll({
      where: {
        userId: req.params.id,
      },
    });

    const photoComments = await PhotoComment.findAll({
      where: {
        userId: req.params.id,
        imageUrl: {
          [Op.ne]: null,
        },
      },
    });


    const chatPhotos = await Message.findAll({
      where: {
        fromUserId: req.params.id,
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
