const { Upload, PhotoComment, User, sequelize } = require('../../../models');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const normalizeS3Key = require('../../../utils/normalizeS3Key');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = require('../../../utils/s3');
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');
const {
  BUCKET,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
} = require('../../uploads/s3/rekognitionConfiguration');

const rekognition = new AWS.Rekognition();

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

async function waitForObjectExists(
  Key,
  { timeoutMs = 4000, intervalMs = 150 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      await s3.headObject({ Bucket: BUCKET, Key }).promise();
      return true;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw lastErr || new Error('Timeout waiting for S3 object');
}

async function getModerationJpegBytes(Key) {
  const obj = await s3.getObject({ Bucket: BUCKET, Key }).promise();
  if (!obj.Body) throw new Error('Empty S3 object body');
  const jpeg = await sharp(obj.Body)
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return jpeg;
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

    const s3KeyRaw = req.file?.transforms?.[0]?.key ?? null;
    const s3Key = s3KeyRaw ? normalizeKey(s3KeyRaw) : null;
    let imageUrl = null;

    if (s3Key) {
      await waitForObjectExists(s3Key);

      const jpegBytes = await getModerationJpegBytes(s3Key);
      const labels = await detectModerationByBytes(jpegBytes);
      const decision = decide(labels);
      console.log('🔎 moderation labels for comment image:', labels);
      console.log('🔎 decision:', decision, 'for', s3Key);

      if (decision !== 'allow') {
        await s3
          .deleteObject({ Bucket: BUCKET, Key: s3Key })
          .promise()
          .catch(() => {});
        return res.status(422).json({
          message: 'Comment image rejected by moderation',
          errors: [
            {
              reason:
                decision === 'block-explicit'
                  ? `Explicit content ≥ ${EXPLICIT_BLOCK_THRESHOLD * 100}%`
                  : `Suggestive content ≥ ${SUGGESTIVE_BLOCK_THRESHOLD * 100}%`,
              labels,
            },
          ],
        });
      }
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
          comment,
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
