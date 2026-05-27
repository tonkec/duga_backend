const { Upload, PhotoComment, User, sequelize } = require('../../../models');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const normalizeS3Key = require('../../../utils/normalizeS3Key');
const sharp = require('sharp');
const s3 = require('../../../utils/s3');
const rekognition = require('../../../utils/rekognition');
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');
const { hasUploadAccess } = require('../../../utils/uploadAccess');
const { sanitizePlainText } = require('../../../utils/plainText');
const {
  BUCKET,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
} = require('../../uploads/s3/rekognitionConfiguration');

function normalizeKey(k) {
  const s = String(k || '').trim();
  return s.startsWith('/') ? s.slice(1) : s;
}

function decide(labels) {
  const hasExplicit = labels.some(
    (l) =>
      (EXPLICIT_LABELS.has(l.Name) || (l.Name || '').includes('Sexual')) &&
      l.Confidence >= EXPLICIT_BLOCK_THRESHOLD * 100
  );

  const hasSuggestive = labels.some(
    (l) =>
      (SUGGESTIVE_LABELS.has(l.Name) || l.ParentName === 'Suggestive') &&
      l.Confidence >= SUGGESTIVE_BLOCK_THRESHOLD * 100
  );

  return hasExplicit
    ? 'block-explicit'
    : hasSuggestive
      ? 'block-suggestive'
      : 'allow';
}

async function getModerationJpegBytes(buffer) {
  if (!buffer) throw new Error('Empty comment image body');

  return sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function detectModerationByBytes(buffer) {
  const out = await rekognition
    .detectModerationLabels({
      Image: { Bytes: buffer },
      MinConfidence: 60,
    })
    .promise();
  return out.ModerationLabels || [];
}

const buildCommentImageKey = (file) => {
  const timestamp = Date.now();
  const originalName = file.originalname || 'comment-image';
  const extension = '.jpg';
  const basename = originalName.replace(/\.[^.]*$/, '');
  const cleanedFilename = removeSpacesAndDashes(
    `${basename}${extension}`.toLowerCase().trim()
  );

  return normalizeKey(
    `${process.env.NODE_ENV}/comment/${timestamp}/${cleanedFilename}`
  );
};

const uploadCommentImageToS3 = async (file) => {
  const jpegBytes = await getModerationJpegBytes(file.buffer);
  const labels = await detectModerationByBytes(jpegBytes);
  const decision = decide(labels);
  console.log('🔎 moderation labels for comment image:', labels);
  console.log('🔎 decision:', decision);

  if (decision !== 'allow') {
    return {
      rejected: true,
      labels,
      decision,
    };
  }

  const key = buildCommentImageKey(file);

  await s3
    .putObject({
      Bucket: BUCKET,
      Key: key,
      Body: jpegBytes,
      ContentType: 'image/jpeg',
      ACL: 'private',
    })
    .promise();

  return {
    key,
    labels,
    decision,
  };
};

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
      return res.status(400).json({
        message: `comment must be ${MAX_COMMENT_LENGTH} characters or less`,
      });
    }
    const sanitizedComment = sanitizePlainText(comment);

    let parsedTags = [];
    if (taggedUserIds && typeof taggedUserIds === 'string') {
      try {
        parsedTags = JSON.parse(taggedUserIds);
      } catch (error) {
        return res
          .status(400)
          .json({ message: 'taggedUserIds must be valid JSON' });
      }

      if (!Array.isArray(parsedTags)) {
        return res
          .status(400)
          .json({ message: 'taggedUserIds must be an array' });
      }
    } else if (Array.isArray(taggedUserIds)) {
      parsedTags = taggedUserIds;
    }

    const upload = await Upload.findByPk(uploadId);
    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    if (!(await hasUploadAccess(userId, uploadId))) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const bufferedCommentImage = req.file?.buffer ? req.file : null;
    let s3Key = null;
    let imageUrl = null;

    if (bufferedCommentImage) {
      const uploadResult = await uploadCommentImageToS3(bufferedCommentImage);

      if (uploadResult.rejected) {
        return res.status(422).json({
          message: 'Comment image rejected by moderation',
          errors: [
            {
              reason:
                uploadResult.decision === 'block-explicit'
                  ? `Explicit content ≥ ${EXPLICIT_BLOCK_THRESHOLD * 100}%`
                  : `Suggestive content ≥ ${SUGGESTIVE_BLOCK_THRESHOLD * 100}%`,
              labels: uploadResult.labels,
            },
          ],
        });
      }

      s3Key = uploadResult.key;
    }

    const photoComment = await sequelize.transaction(async (transaction) => {
      if (s3Key) {
        const cleanedName = removeSpacesAndDashes(
          req.file.originalname.toLowerCase().trim()
        );
        const normalizedKey = normalizeS3Key(s3Key); // Removes env and sanitizes

        await Upload.create(
          {
            url: s3Key,
            name: cleanedName,
            filetype: 'image/jpeg',
            userId,
          },
          { transaction }
        );

        imageUrl = normalizedKey;
      }

      const createdComment = await PhotoComment.create(
        {
          userId,
          uploadId,
          comment: sanitizedComment,
          imageUrl,
        },
        { transaction }
      );

      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        await createdComment.setTaggedUsers(parsedTags, { transaction });
      }

      return createdComment;
    });

    const fullComment = await PhotoComment.findByPk(photoComment.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'publicId', 'username'] },
        {
          model: User,
          as: 'taggedUsers',
          attributes: ['id', 'publicId', 'username'],
        },
      ],
    });

    const securePhotoUrl = imageUrl
      ? attachSecureUrl(
          API_BASE_URL,
          `${process.env.NODE_ENV}/${imageUrl}`,
          getBearerToken(req)
        )
      : null;

    return res.status(201).send({
      data: {
        ...fullComment.toJSON(),
        securePhotoUrl,
      },
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        errors: [
          {
            reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.`,
          },
        ],
      });
    }
    if (error.message?.includes('Invalid file type')) {
      return res.status(413).json({ errors: [{ reason: `Nepodržan format` }] });
    }
    console.error('❌ Error adding comment:', error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = handleAddComment;
