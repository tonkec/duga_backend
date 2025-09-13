const { Upload, PhotoComment, User } = require('../../../models');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const normalizeS3Key = require('../../../utils/normalizeS3Key');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = require('../../../utils/s3');
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

  return hasExplicit ? 'block-explicit' : hasSuggestive ? 'block-suggestive' : 'allow';
}

async function waitForObjectExists(Key, { timeoutMs = 4000, intervalMs = 150 } = {}) {
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

const handleAddComment = async (req, res) => {
  try {
    const { uploadId, comment, taggedUserIds } = req.body;
    const userId = req.auth.user.id;

    const s3KeyRaw = req.file?.transforms?.[0]?.key ?? null;
    let imageUrl = null;

    if (s3KeyRaw) {
      const s3Key = normalizeKey(s3KeyRaw); 
      const cleanedName = removeSpacesAndDashes(req.file.originalname.toLowerCase().trim());
      const normalizedKeyForStreaming = normalizeS3Key(s3Key);

      await waitForObjectExists(s3Key);

      const jpegBytes = await getModerationJpegBytes(s3Key);

      const labels = await detectModerationByBytes(jpegBytes);
      const decision = decide(labels);
      console.log('🔎 moderation labels for comment image:', labels);
      console.log('🔎 decision:', decision, 'for', s3Key);

      if (decision !== 'allow') {
        await s3.deleteObject({ Bucket: BUCKET, Key: s3Key }).promise().catch(() => {});
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

      await Upload.create({
        url: s3Key,         
        name: cleanedName,
        userId,
      });

      imageUrl = normalizedKeyForStreaming;
    }

    const photoComment = await PhotoComment.create({
      userId,
      uploadId,
      comment,
      imageUrl,
    });

    if (taggedUserIds && typeof taggedUserIds === 'string') {
      const parsed = JSON.parse(taggedUserIds);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await photoComment.setTaggedUsers(parsed);
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
      return res.status(400).json({ message: 'Image too big' });
    }
    if (error.message?.includes('Invalid file type')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('❌ Error adding comment:', error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = handleAddComment;
