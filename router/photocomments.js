const express = require('express');
const router = express.Router();
const { PhotoComment } = require('../models');
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const uploadCommentImage = require('./comments/s3/uploadCommentImage');
const handleAddComment = require('./comments/handlers/handleAddComment');
const handleGetComments = require('./comments/handlers/handleGetComments');
const handleUpdateComment = require('./comments/handlers/handleUpdateComment');
const handleGetLatestComments = require('./comments/handlers/handleGetLatestComments');
const handleDeleteComment = require('./comments/handlers/handleDeleteComment');
const upload = uploadCommentImage.single('commentImage');
const LIMIT_FILE_SIZE = require('../consts/limitFileSize');

require('./comments/swagger/addComment.swagger');
router.post(
  '/add-comment',
  [
    ...authenticatedAppSession,
    (req, res, next) => {
      upload(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            errors: [
              {
                reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.`,
              },
            ],
          });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res
            .status(413)
            .json({ errors: [{ reason: `Nepodržan format` }] });
        }

        // Custom or unknown errors
        return res
          .status(400)
          .json({ message: err.message || 'Upload error.' });
      });
    },
  ],
  handleAddComment
);
require('./comments/swagger/getComments.swagger');
router.get(
  '/get-comments/:uploadId',
  authenticatedAppSession,
  handleGetComments
);

require('./comments/swagger/updateComment.swagger');
router.put(
  '/update-comment/:id',
  [
    ...authenticatedAppSession,
    withAccessCheck(PhotoComment, async (req) => {
      const commentId = Number(req.params.id);
      if (!commentId) return null;
      return await PhotoComment.findByPk(commentId);
    }),
  ],
  handleUpdateComment
);

require('./comments/swagger/latestComments.swagger');
router.get('/latest', authenticatedAppSession, handleGetLatestComments);

require('./comments/swagger/deleteComment.swagger');
router.delete(
  '/delete-comment/:id',
  [...authenticatedAppSession, withAccessCheck(PhotoComment)],
  handleDeleteComment
);

module.exports = router;
