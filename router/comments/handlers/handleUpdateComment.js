const { PhotoComment, User } = require('../../../models');

const handleUpdateComment = async (req, res) => {
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
};

module.exports = handleUpdateComment;
