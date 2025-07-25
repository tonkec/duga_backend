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
const {API_BASE_URL} = require("../consts/apiBaseUrl");

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

router.get('/files/*', checkJwt, async (req, res) => {
  const rawKey = req.params[0];
  const key = decodeURIComponent(rawKey);
  console.log('🔍 Requested key:', key);
  
  
  try {
    let file = await Upload.findOne({ where: { url: key} });

    if (!file) {
      console.log('🔍 Not found in Upload. Checking PhotoComment.imageUrl...');
      const commentWithImage = await PhotoComment.findOne({ where: { imageUrl: key } });

      if (commentWithImage) {
        console.log('✅ Found in PhotoComment.imageUrl');
        file = { url: commentWithImage.imageUrl };
      }
    }

    let messageWithImage;
    if (!file) {
      console.log('🔍 Not found in Comment. Checking Message.messagePhotoUrl...');
      messageWithImage = await Message.findOne({ where: { messagePhotoUrl: key } });

      if (messageWithImage) {
        console.log('✅ Found in Message.messagePhotoUrl');
        file = { url: messageWithImage.messagePhotoUrl };
      }
    }

    if (!file) {
      console.log('❌ Not found in Upload, Comment, or Message');
      return res.status(404).json({ message: 'File not found in DB' });
    }

    const normalizedKey = removeSpacesAndDashes(key).startsWith(`${process.env.NODE_ENV}/`)
  ? key
  : `${process.env.NODE_ENV}/${removeSpacesAndDashes(key)}`;
    const s3Stream = s3
      .getObject({
        Bucket: 'duga-user-photo',
        Key: normalizedKey.toLowerCase()
      })
      .createReadStream();
    
    
    s3Stream.on('error', (err) => {
      console.error('❌ Stream error:', err); // Log here!
      res.status(404).json({ message: 'Image not found on S3' });
    });

    res.setHeader('Content-Type', 'image/png'); 
    return s3Stream.pipe(res);
  } catch (err) {
    console.error('🔥 S3 fetch failed:', err);
  }
});

router.delete('/delete-photo', [checkJwt], async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Photo URL is required.' });
  }

  try {
    const extractKeyFromUrl = (url) => {
      try {
        const u = new URL(url);
        return decodeURIComponent(u.pathname.slice(1));
      } catch {
        return url; 
      }
    };

    const key = extractKeyFromUrl(url);
    let deletedFrom = null;

    // Try Upload
    const upload = await Upload.findOne({ where: { url: key } });
    if (upload) {
      await upload.destroy();
      deletedFrom = 'Upload';
    }

    // Try PhotoComment
    if (!deletedFrom) {
      const comment = await PhotoComment.findOne({ where: { imageUrl: key } });
      if (comment) {
        await comment.setTaggedUsers([]);
        await comment.destroy();
        deletedFrom = 'PhotoComment';
      }
    }

    // Try Message
    if (!deletedFrom) {
      const message = await Message.findOne({ where: { messagePhotoUrl: key } });
      if (message) {
        await message.destroy(); // FULLY DELETE THE MESSAGE
        deletedFrom = 'Message';
      }
    }

    if (!deletedFrom) {
      return res.status(404).json({ error: 'No matching record found for this photo.' });
    }

    // Delete the actual file from S3
    await s3
      .deleteObject({
        Bucket: 'duga-user-photo',
        Key: key,
      })
      .promise(); 

    return res.status(200).json({
      message: `Photo and associated ${deletedFrom} record deleted successfully.`,
    });
  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    return res.status(500).json({ error: 'Server error during deletion.' });
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
    const secureUrl = addSecureUrlsToList([plainUpload], API_BASE_URL)[0].securePhotoUrl;

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
    console.log(e)
    return res.status(500).json({ message: e.message });
  }
});

router.get("/user-photos", [checkJwt, attachCurrentUser], async (req, res) => {
  try {
    const userId = req.auth?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const uploads = await Upload.findAll({
      where: { userId },
      attributes: ['id', 'url', 'description', 'createdAt'],
    });

    const allPhotos = uploads
      .map(upload => {
        const key = upload.url;
        return {
          ...upload.toJSON(),
          type: 'upload',
          originalField: 'url',
          securePhotoUrl: `${API_BASE_URL}/uploads/files/${encodeURIComponent(key)}`,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(allPhotos);
  } catch (error) {
    console.error('Error fetching user photos:', error);
    return res.status(500).json({
      message: 'Error occurred while fetching user photos',
    });
  }
});


router.get("/profile-photo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const upload = await Upload.findOne({
      where: {
        userId: id,
        isProfilePhoto: true,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!upload) {
      return res.json({ securePhotoUrl: null });
    }

    const [secureUpload] = addSecureUrlsToList([upload], API_BASE_URL, 'url'); 
    return res.json({ securePhotoUrl: secureUpload.securePhotoUrl });
  } catch (error) {
    console.error('Error fetching profile photo:', error);
    return res.status(500).json({ error: 'Failed to fetch profile photo' });
  }
});


module.exports = router;
