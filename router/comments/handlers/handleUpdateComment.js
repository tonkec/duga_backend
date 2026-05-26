const { PhotoComment, User } = require('../../../models');

const MAX_COMMENT_LENGTH = 1000;

const handleUpdateComment = async (req, res) => {
  try {
    const { comment, taggedUserIds } = req.body;
    const photoComment = req.resource;

    if (typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ message: 'comment is required' });
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `comment must be ${MAX_COMMENT_LENGTH} characters or less`,
      });
    }

    photoComment.comment = comment;
    await photoComment.save();

    if (Array.isArray(taggedUserIds)) {
      await photoComment.setTaggedUsers(taggedUserIds);
    }

    const fullUpdatedComment = await PhotoComment.findByPk(photoComment.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'publicId', 'username'] },
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    });

    return res.status(200).send({ data: fullUpdatedComment });
  } catch (error) {
    console.error('❌ Error updating comment:', error);
    return res.status(500).send({
      message: 'Error occurred while updating comment',
    });
  }
};

module.exports = handleUpdateComment;
