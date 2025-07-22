const express = require('express');
const router = express.Router();

const { Upload, User, PhotoComment } = require('../models');
const { checkJwt } = require('../middleware/auth');
const attachCurrentUser = require('../middleware/attachCurrentUser');
const withAccessCheck = require('../middleware/accessCheck');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const s3 = require('../utils/s3');
const allowedMimeTypes = require("../consts/allowedFileTypes");
const { extractKeyFromUrl } = require('../utils/secureUploadUrl');
const {API_BASE_URL }= require("../consts/apiBaseUrl");

function addSecureUrlsToList(items, baseUrl, originalField = 'url', newField = 'secureUrl') {
  return items.map((item) => {
    const plain = item.toJSON ? item.toJSON() : item;
    const originalUrl = plain[originalField];

    if (!originalUrl) {
      console.warn(`⚠️ Skipping item with missing ${originalField}`);
      plain[newField] = null;
      return plain;
    }

    const key = extractKeyFromUrl(originalUrl);
    console.log('🔍 Extracting key from URL:', originalUrl);

    if (key) {
      plain[newField] = `${baseUrl}/uploads/files/${encodeURIComponent(key)}`;
    } else {
      console.warn('🚨 Could not generate secure URL for comment:', originalUrl);
      plain[newField] = null;
    }

    return plain;
  });
}

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
  }),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
      error.code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  },
});

/**
 * @swagger
 * /comments/add-comment:
 *   post:
 *     summary: Add a comment to an upload
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               uploadId:
 *                 type: string
 *               comment:
 *                 type: string
 *               taggedUserIds:
 *                 type: string
 *                 description: JSON stringified array of user IDs
 *               commentImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Bad request or image too large
 *       500:
 *         description: Server error
 */
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
      const { uploadId, comment, taggedUserIds } = req.body;
      const userId = req.auth.user.id;

      const s3Key = req.file?.transforms?.[0]?.key ?? null;
      let commentImageUpload = null;

      if (s3Key) {
        commentImageUpload = await Upload.create({
          url: s3Key,
          name: req.file.originalname,
          userId,
        });
      }

      const photoComment = await PhotoComment.create({
        userId,
        uploadId,
        comment,
        imageUrl: commentImageUpload?.url || null,
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

/**
 * @swagger
 * /comments/get-comments/{uploadId}:
 *   get:
 *     summary: Get all comments for a specific upload
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uploadId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 *       500:
 *         description: Server error
 */
router.get('/get-comments/:uploadId', [checkJwt], async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      where: { uploadId: req.params.uploadId },
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

    const commentsWithSecureUrls = addSecureUrlsToList(
      photoComments,
      API_BASE_URL,
      'imageUrl',
      'secureImageUrl'
    );

    return res.status(200).send(commentsWithSecureUrls);
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
});

/**
 * @swagger
 * /comments/update-comment/{id}:
 *   put:
 *     summary: Update a specific comment
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *               taggedUserIds:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Comment updated
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /comments/latest:
 *   get:
 *     summary: Get the latest 5 comments
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of latest comments
 *       500:
 *         description: Server error
 */
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

    const commentsWithSecureUrls = addSecureUrlsToList(
      photoComments,
      API_BASE_URL,
      'imageUrl',
      'secureImageUrl'
    );

    res.status(200).json(commentsWithSecureUrls);
  } catch (error) {
    console.error('❌ Error in /comments/latest:', error);
    res.status(500).json({ message: 'Error occurred while fetching comments' });
  }
});

/**
 * @swagger
 * /comments/delete-comment/{id}:
 *   delete:
 *     summary: Delete a specific comment and its image (if exists)
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *       500:
 *         description: Server error
 */
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
          await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
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