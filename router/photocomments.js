const Upload = require('../models').Upload;
const User = require('../models').User;
const PhotoComment = require('../models').PhotoComment;
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();

router.post('/add-comment', [checkJwt], async (req, res) => {
  try {
    const { userId, uploadId, comment, taggedUserIds } = req.body;

    const upload = await Upload.findOne({
      where: { id: uploadId },
    });

    if (!upload) {
      return res.status(404).send({ message: 'Upload not found' });
    }

    const photoComment = await PhotoComment.create({
      userId,
      uploadId,
      comment,
    });

    if (taggedUserIds && Array.isArray(taggedUserIds) && taggedUserIds.length > 0) {
      await photoComment.setTaggedUsers(taggedUserIds);
    }

    const fullComment = await PhotoComment.findByPk(photoComment.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] },
        { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
      ],
    });

    return res.status(201).send({ data: fullComment });
  } catch (error) {
    console.log('❌ Error adding comment:', error);
    return res.status(500).send({
      message: 'Error occurred while adding comment',
    });
  }
});

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

    return res.status(200).send(photoComments);
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return res.status(500).send({
      message: 'Error occurred while fetching comments',
    });
  }
});

router.put('/update-comment/:id', [checkJwt], async (req, res) => {
  try {
    const { comment, taggedUserIds } = req.body;

    const photoComment = await PhotoComment.findOne({
      where: { id: req.params.id },
    });

    if (!photoComment) {
      return res.status(404).send({ message: 'Comment not found' });
    }

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
});

router.get("/latest", [checkJwt], async (req, res) => {
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

router.delete('/delete-comment/:id', [checkJwt], async (req, res) => {
  try {
    const photoComment = await PhotoComment.findOne({
      where: { id: req.params.id },
    });

    if (!photoComment) {
      return res.status(404).send({
        message: 'Comment not found',
      });
    }

    await photoComment.setTaggedUsers([]);

    await photoComment.destroy();

    return res.status(200).send({
      commentId: req.params.id,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    return res.status(500).send({
      message: 'Error occurred while deleting comment',
    });
  }
});


module.exports = router;
