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
const addSecureUrlsToList = require('../utils/secureUploadUrl').addSecureUrlsToList;
const API_BASE_URL = `${process.env.APP_URL}:${process.env.APP_PORT}`;

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

// GET /files/:key*  (wildcard match for full S3 key)
router.get('/files/*', checkJwt, async (req, res) => {
  const rawKey = req.params[0];
  const key = decodeURIComponent(rawKey);
  console.log('🔍 Requested key:', key);

  try {
    let file = await Upload.findOne({ where: { url: `${process.env.NODE_ENV}/${key}` } });

    // Check in PhotoComment.imageUrl if not found in Uploads
    if (!file) {
      console.log('🔍 Not found in Upload. Checking PhotoComment.imageUrl...');
      const commentWithImage = await PhotoComment.findOne({ where: { imageUrl: key } });

      if (commentWithImage) {
        console.log('✅ Found in PhotoComment.imageUrl');
        file = { url: commentWithImage.imageUrl };
      }
    }

    // Check in Message.messagePhotoUrl if still not found
    if (!file) {
      console.log('🔍 Not found in Comment. Checking Message.messagePhotoUrl...');
      const messageWithImage = await Message.findOne({ where: { messagePhotoUrl: key } });

      if (messageWithImage) {
        console.log('✅ Found in Message.messagePhotoUrl');
        file = { url: messageWithImage.messagePhotoUrl };
      }
    }

    if (!file) {
      console.log('❌ Not found in Upload, Comment, or Message');
      return res.status(404).json({ message: 'File not found in DB' });
    }
console.log(key, '🔑 Key to fetch from S3:', key);
    // Fetch from S3
    const s3Stream = s3
      .getObject({
        Bucket: 'duga-user-photo',
        Key: `${process.env.NODE_ENV}/${key}`, // Ensure the key matches the S3 structure
      })
      .createReadStream();

    res.setHeader('Content-Type', 'image/png'); // optionally detect from key
    return s3Stream.pipe(res);
  } catch (err) {
    console.error('🔥 S3 fetch failed:', err);
    return res.status(500).json({ message: 'S3 fetch failed' });
  }
});

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
  [checkJwt, attachCurrentUser, uploadMessageImage(s3).array('avatars', MAX_NUMBER_OF_FILES)],
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const uploaded = await Promise.all(
        req.files.map(async (file) => {
          const key = file.transforms?.find((t) => t.id === 'original')?.key;
          
          const thumbnailKey = file.transforms?.find((t) => t.id === 'thumbnail')?.key;

          const uploadRecord = await Upload.create({
            name: file.originalname,
            url: key,
            filetype: file.mimetype,
            userId: req.auth.user.id, 
          });

          return {
            id: uploadRecord.id,
            originalName: file.originalname,
            key,
            secureUrl: `${API_BASE_URL}/uploads/files/${encodeURIComponent(key)}`,
            thumbnailUrl: thumbnailKey
              ? `${API_BASE_URL}/uploads/files/${encodeURIComponent(thumbnailKey)}`
              : null,
          };
        })
      );

      return res.status(200).json({ message: 'Upload successful', files: uploaded });
    } catch (error) {
      if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ message: error.message });
      }

      console.error('❌ Upload error:', error);
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

    const plainUpload = upload.toJSON();
    const secureUrl = addSecureUrlsToList([plainUpload], API_BASE_URL)[0].secureUrl;

    return res.status(200).send({
      ...plainUpload,
      secureUrl,
    });
  } catch (error) {
    console.error('❌ Error fetching photo:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching photo',
    });
  }
});


router.get('/latest', [checkJwt], async (req, res) => {
  try {
    const uploads = await Upload.findAll({
      limit: 3,
      order: [['createdAt', 'DESC']],
    });

    const result = addSecureUrlsToList(uploads, API_BASE_URL);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/user-photos", [checkJwt, attachCurrentUser], async (req, res) => {
  try {
    const userId = req.auth?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [uploads, photoComments, chatPhotos] = await Promise.all([
      Upload.findAll({
        where: { userId },
        attributes: ['id', 'url', 'description', 'createdAt'],
      }),
      PhotoComment.findAll({
        where: {
          userId,
          imageUrl: { [Op.ne]: null },
        },
        attributes: ['id', 'imageUrl', 'comment', 'createdAt'],
      }),
      Message.findAll({
        where: {
          fromUserId: userId,
          messagePhotoUrl: {
            [Op.and]: [
              { [Op.ne]: null },
              { [Op.notILike]: '%.gif' },
              { [Op.notILike]: '%giphy%' }, 
            ],
          },
        },
        attributes: ['id', 'messagePhotoUrl', 'createdAt'],
      }),
    ]);

    const normalizedUploads = uploads.map(photo => ({
      ...photo.toJSON(),
      url: photo.url,
      type: 'upload',
    }));

    const normalizedComments = photoComments.map(photo => ({
      ...photo.toJSON(),
      url: photo.imageUrl,
      type: 'comment',
    }));

    const normalizedMessages = chatPhotos.map(photo => ({
      ...photo.toJSON(),
      url: photo.messagePhotoUrl,
      type: 'message',
    }));

    const allPhotos = [...normalizedUploads, ...normalizedComments, ...normalizedMessages];
    allPhotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(allPhotos);
  } catch (error) {
    console.error('Error fetching user photos:', error);
    return res.status(500).json({
      message: 'Error occurred while fetching user photos',
    });
  }
});


module.exports = router;
