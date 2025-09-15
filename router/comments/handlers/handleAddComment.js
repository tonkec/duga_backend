const { Upload, PhotoComment, User } = require('../../../models');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const normalizeS3Key = require('../../../utils/normalizeS3Key');

const handleAddComment = async (req, res) => {
  try {
    const { uploadId, comment, taggedUserIds } = req.body;
    const userId = req.auth.user.id;

    const s3Key = req.file?.transforms?.[0]?.key ?? null;
    let commentImageUpload = null;
    let imageUrl = null;

    if (s3Key) {
      const cleanedName = removeSpacesAndDashes(
        req.file.originalname.toLowerCase().trim()
      );
      const normalizedKey = normalizeS3Key(s3Key); // Removes env and sanitizes

      commentImageUpload = await Upload.create({
        url: s3Key,
        name: cleanedName,
        userId,
      });

      imageUrl = normalizedKey; 
    }

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

    const securePhotoUrl = imageUrl
      ? `${process.env.API_BASE_URL}/uploads/files/${encodeURIComponent(
          `${process.env.NODE_ENV}/${imageUrl}`
        )}`
      : null;

    return res.status(201).send({
      data: {
        ...fullComment.toJSON(),
        securePhotoUrl,
      },
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({errors: [{ reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.` }] });
    }

    if (error.message?.includes('Invalid file type')) {
      return res.status(413).json({errors: [{ reason: `Nepodržan format` }] });
    }

    console.error('❌ Error adding comment:', error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = handleAddComment;
