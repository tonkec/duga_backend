const { Upload, PhotoComment, User, sequelize } = require('../../../models');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const normalizeS3Key = require('../../../utils/normalizeS3Key');
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');

const MAX_COMMENT_LENGTH = 1000;

const handleAddComment = async (req, res) => {
  try {
    const { uploadId, comment, taggedUserIds } = req.body;
    const userId = req.auth.user.id;

    if (!uploadId) {
      return res.status(400).json({ message: 'uploadId is required' });
    }

    if (typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ message: 'comment is required' });
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ message: `comment must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    let parsedTags = [];
    if (taggedUserIds && typeof taggedUserIds === 'string') {
      try {
        parsedTags = JSON.parse(taggedUserIds);
      } catch (error) {
        return res.status(400).json({ message: 'taggedUserIds must be valid JSON' });
      }

      if (!Array.isArray(parsedTags)) {
        return res.status(400).json({ message: 'taggedUserIds must be an array' });
      }
    }

    const upload = await Upload.findByPk(uploadId);
    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    const s3Key = req.file?.transforms?.[0]?.key ?? null;
    let imageUrl = null;

    const photoComment = await sequelize.transaction(async (transaction) => {
      if (s3Key) {
        const cleanedName = removeSpacesAndDashes(
          req.file.originalname.toLowerCase().trim()
        );
        const normalizedKey = normalizeS3Key(s3Key); // Removes env and sanitizes

        await Upload.create({
          url: s3Key,
          name: cleanedName,
          userId,
        }, { transaction });

        imageUrl = normalizedKey;
      }

      const createdComment = await PhotoComment.create({
        userId,
        uploadId,
        comment,
        imageUrl,
      }, { transaction });

      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        await createdComment.setTaggedUsers(parsedTags, { transaction });
      }

      return createdComment;
    });

    const fullComment = await PhotoComment.findByPk(photoComment.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] },
        { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
      ],
    });

    const securePhotoUrl = imageUrl
      ? attachSecureUrl(API_BASE_URL, `${process.env.NODE_ENV}/${imageUrl}`, getBearerToken(req))
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
