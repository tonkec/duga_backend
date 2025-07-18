const Upload = require('../models').Upload;
const User = require('../models').User;
const PhotoComment = require('../models').PhotoComment;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const s3 = require('../utils/s3');
const allowedMimeTypes = require("../consts/allowedFileTypes")
const attachCurrentUser = require('../middleware/attachCurrentUser');
const withAccessCheck = require('../middleware/accessCheck');

const uploadCommentImage = multer({
  storage: multerS3({
    s3,
    bucket: "duga-user-photo",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    shouldTransform: true,
    transforms: [
      {
        id: "commentImageResized",
        key: function (req, file, cb) {
          const timestamp = Date.now();
          const filename = `${file.originalname}`;
          const path = `${process.env.NODE_ENV}/comment/${timestamp}/${filename}`;
          cb(null, path);
        },
        transform: function (req, file, cb) {
          cb(null, sharp().resize(1024).jpeg({ quality: 80 }));
        },
      },
    ],
    acl: "public-read",
  }),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
      error.code = 'INVALID_FILE_TYPE';
      cb(new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.'));
    }
  },
});

router.post(
  '/add-comment',
  [
    checkJwt,
    attachCurrentUser,
    uploadCommentImage.single('commentImage'), 
    withAccessCheck(Upload, async (req) => {
      const { uploadId } = req.body;
      if (!uploadId) return null;
      return await Upload.findOne({ where: { id: uploadId } });
    }),
  ],
  async (req, res) => {
    try {
      const { comment, taggedUserIds } = req.body;
      const userId = req.auth.user.id;
      const uploadId = req.resource.id;

      const imageUrl = req.file?.transforms?.[0]?.location ?? null;

      const photoComment = await PhotoComment.create({
        userId,
        uploadId,
        comment,
        imageUrl,
      });

      if (taggedUserIds && typeof taggedUserIds === 'string') {
        const parsedTags = JSON.parse(taggedUserIds);
        if (Array.isArray(parsedTags) && parsedTags.length > 0) {
          await photoComment.setTaggedUsers(parsedTags);
        }
      }

      const fullComment = await PhotoComment.findByPk(photoComment.id, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
        ],
      });

      return res.status(201).send({ data: fullComment });
    } catch (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image too big' });
      }

      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({ message: error.message });
      }

      console.error('❌ Error adding comment:', error);
      return res.status(500).json({ message: 'Something went wrong' });
    }
  }
);


router.get(
  '/get-comments/:uploadId',
  [checkJwt],
  async (req, res) => {
    try {
      const uploadId = req.params.uploadId;
      const photoComments = await PhotoComment.findAll({
        where: { uploadId },
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: User,
            as: 'taggedUsers',
            attributes: ['id', 'username'],
            through: { attributes: [] },
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username'],
          },
        ],
      });

      return res.status(200).send(photoComments);
    } catch (error) {
      console.error('❌ Error fetching comments:', error);
      return res.status(500).send({
        message: 'Error occurred while fetching comments',
      });
    }
  }
);


router.put(
  '/update-comment/:id',
  [
    checkJwt,
    withAccessCheck(PhotoComment, async (req) => {
      const commentId = Number(req.params.id);
      if (!commentId) return null;
      return await PhotoComment.findByPk(commentId);
    }),
  ],
  async (req, res) => {
    try {
      const { comment, taggedUserIds } = req.body;
      const photoComment = req.resource;

      photoComment.comment = comment;
      await photoComment.save();

      if (Array.isArray(taggedUserIds)) {
        await photoComment.setTaggedUsers(taggedUserIds);
      }

      const fullUpdatedComment = await PhotoComment.findByPk(photoComment.id, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
        ],
      });

      return res.status(200).send({ data: fullUpdatedComment });
    } catch (error) {
      console.error('❌ Error updating comment:', error);
      return res.status(500).send({
        message: 'Error occurred while updating comment',
      });
    }
  }
);

router.get("/latest", [checkJwt], async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
        },
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'username'],
          through: { attributes: [] }, 
        },
      ],
    });

    return res.status(200).send(photoComments);
  } catch (error) {
    console.error("❌ Error in /latest:", error);
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
});

router.delete(
  '/delete-comment/:id',
  [checkJwt, withAccessCheck(PhotoComment)],
  async (req, res) => {
    try {
      const photoComment = req.resource; 

      if (photoComment.imageUrl) {
        const bucket = 'duga-user-photo';
        const s3Url = new URL(photoComment.imageUrl);
        const key = decodeURIComponent(s3Url.pathname.slice(1));

        try {
          await s3
            .deleteObject({
              Bucket: bucket,
              Key: key,
            })
            .promise();
          console.log('✅ Comment image deleted from S3');
        } catch (err) {
          console.warn('⚠️ Failed to delete comment image from S3:', err);
        }
      }

      await photoComment.setTaggedUsers([]);
      await photoComment.destroy();

      return res.status(200).send({
        commentId: req.params.id,
        message: 'Comment and image deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      return res.status(500).send({
        message: 'Error occurred while deleting comment',
      });
    }
  }
);

module.exports = router;
