const express = require('express');
const router = express.Router();
const { Upload, PhotoComment } = require('../models');
const { checkJwt } = require('../middleware/auth');
const attachCurrentUser = require('../middleware/attachCurrentUser');
const withAccessCheck = require('../middleware/accessCheck');
const uploadCommentImage = require("./comments/s3/uploadCommentImage")
const handleAddComment = require("./comments/handlers/handleAddComment");
const handleGetComments = require("./comments/handlers/handleGetComments");
const handleUpdateComment = require("./comments/handlers/handleUpdateComment");
const handleGetLatestComments = require("./comments/handlers/handleGetLatestComments");
const handleDeleteComment = require("./comments/handlers/handleDeleteComment");

require('./comments/swagger/addComment.swagger');
router.post(
  '/add-comment',
  [
    checkJwt,
    attachCurrentUser,
    uploadCommentImage.single('commentImage'),
  ],
  handleAddComment
);

require('./comments/swagger/getComments.swagger');
router.get('/get-comments/:uploadId', [checkJwt], handleGetComments);

require('./comments/swagger/updateComment.swagger');
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
  handleUpdateComment
);

require('./comments/swagger/latestComments.swagger');
router.get("/latest", [checkJwt], handleGetLatestComments);

require('./comments/swagger/deleteComment.swagger');
router.delete(
  '/delete-comment/:id',
  [checkJwt, withAccessCheck(PhotoComment)],
  handleDeleteComment
);

module.exports = router;