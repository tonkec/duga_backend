const Upload = require('../models').Upload;
const PhotoComment = require('../models').PhotoComment;
const { auth } = require('../middleware/auth');
const router = require('express').Router();

router.post('/add-comment', [auth], async (req, res) => {
  try {
    const upload = await Upload.findOne({
      where: {
        id: req.body.uploadId,
      },
    });

    if (!upload) {
      return res.status(404).send({
        message: 'Upload not found',
      });
    }

    const photoComment = await PhotoComment.create({
      userId: req.body.userId,
      uploadId: req.body.uploadId,
      comment: req.body.comment,
    });

    return res.status(201).send(photoComment);
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      message: 'Error occurred while adding comment',
    });
  }
});

router.get('/get-comments/:uploadId', async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      where: {
        uploadId: req.params.uploadId,
      },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).send(photoComments);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
});

router.put('/update-comment/:id', [auth], async (req, res) => {
  try {
    const photoComment = await PhotoComment.findOne({
      where: {
        id: req.params.id,
      },
    });

    if (!photoComment) {
      return res.status(404).send({
        message: 'Comment not found',
      });
    }

    photoComment.comment = req.body.comment;

    await photoComment.save();

    return res.status(200).send(photoComment);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while updating comment',
    });
  }
});

router.get("/latest", async (req, res) => {
  try {
    const photoComments = await PhotoComment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).send(photoComments);
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
} );

router.delete('/delete-comment/:id', [auth], async (req, res) => {
  try {
    const photoComment = await PhotoComment.findOne({
      where: {
        id: req.params.id,
      },
    });

    if (!photoComment) {
      return res.status(404).send({
        message: 'Comment not found',
      });
    }

    await photoComment.destroy();

    return res.status(200).send({
      commentId: req.params.id,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    return res.status(500).send({
      message: 'Error occurred while deleting comment',
    });
  }
});

module.exports = router;
