const { Upload } = require('../../../models');
const { normalizeS3Key } = require('../../../utils/normalizeS3Key');
const s3 = require('../../../utils/s3');

const handleDeleteComment = async (req, res) => {
  try {
    const photoComment = req.resource;

    if (photoComment.imageUrl) {
      const bucket = 'duga-user-photo';
      const envPrefix = `${process.env.NODE_ENV}/`;

      const normalizedKey = normalizeS3Key(photoComment.imageUrl);
      const s3Key = `${envPrefix}${normalizedKey}`;

      try {
        await s3.deleteObject({ Bucket: bucket, Key: s3Key }).promise();
        console.log('✅ Comment image deleted from S3');
      } catch (err) {
        console.warn('⚠️ Failed to delete comment image from S3:', err);
      }

      const upload = await Upload.findOne({ where: { url: s3Key } });
      if (upload) {
        await upload.destroy();
        console.log('✅ Upload record deleted');
      }
    }

    await photoComment.setTaggedUsers([]);
    await photoComment.destroy();

    return res.status(200).send({
      commentId: req.params.id,
      message: 'Comment, image, and upload deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    return res.status(500).send({
      message: 'Error occurred while deleting comment',
    });
  }
};

module.exports = handleDeleteComment;
