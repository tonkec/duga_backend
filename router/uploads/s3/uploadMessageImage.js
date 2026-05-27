const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const rekognition = require('../../../utils/rekognition');
const { ChatUser } = require('../../../models');
const { MAX_NUMBER_OF_FILES } = require('../../../consts/maxNumberOfFiles');
const {
  BUCKET,
  UPLOAD_MESSAGE_IMAGE_FIELD_NAME,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
} = require('../s3/rekognitionConfiguration');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');

const getAuthorizedChatId = async (req, res) => {
  const chatId = Number(req.body?.chatId);
  const userId = req.auth?.user?.id;

  if (!Number.isInteger(chatId) || chatId <= 0) {
    res.status(400).json({ message: 'Invalid or missing chatId' });
    return null;
  }

  const membership = await ChatUser.findOne({
    where: { chatId, userId },
    attributes: ['id'],
  });

  if (!membership) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  return chatId;
};

const uploadMessageImage = (s3) => {
  if (!s3 || typeof s3.putObject !== 'function') {
    throw new Error('Expected an AWS SDK v2 S3 client');
  }

  // 1) Buffer files in memory (no S3 yet)
  const memory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LIMIT_FILE_SIZE, files: MAX_NUMBER_OF_FILES },
    fileFilter(req, file, cb) {
      if (
        ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
          file.mimetype
        )
      )
        return cb(null, true);
      const err = new Error(
        'Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.'
      );
      err.code = 'INVALID_FILE_TYPE';
      cb(err);
    },
  }).array(UPLOAD_MESSAGE_IMAGE_FIELD_NAME, MAX_NUMBER_OF_FILES);

  // 2) Moderate -> upload allowed -> mimic transforms
  async function processAndUpload(req, res, next) {
    try {
      req.rejectedFiles = [];
      if (!req.files?.length) return next();

      const chatId = await getAuthorizedChatId(req, res);
      if (!chatId) return;

      const env = process.env.NODE_ENV || 'development';
      const timestamp = Date.now();

      const allowed = [];
      for (const [index, file] of req.files.entries()) {
        const normalized = await sharp(file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer();

        const mod = await rekognition
          .detectModerationLabels({
            Image: { Bytes: normalized },
            MinConfidence: 60,
          })
          .promise();

        const rawLabels = mod.ModerationLabels || [];
        const labels = rawLabels.map((l) => ({
          name: l.Name,
          parent: l.ParentName,
          confidence: l.Confidence || 0,
        }));

        const hasExplicit = labels.some(
          (l) =>
            (EXPLICIT_LABELS.has(l.name) ||
              (l.name || '').includes('Sexual')) &&
            l.confidence >= EXPLICIT_BLOCK_THRESHOLD * 100
        );

        const hasSuggestive = labels.some(
          (l) =>
            (SUGGESTIVE_LABELS.has(l.name) || l.parent === 'Suggestive') &&
            l.confidence >= SUGGESTIVE_BLOCK_THRESHOLD * 100
        );

        const decision = hasExplicit
          ? 'block-explicit'
          : hasSuggestive
            ? 'block-suggestive'
            : 'allow';

        console.log('🔎 moderation labels:', labels);
        console.log('🔎 decision:', decision);

        if (decision !== 'allow') {
          req.rejectedFiles.push({
            originalName: file.originalname,
            reason:
              decision === 'block-explicit'
                ? `Blocked: Explicit content ≥ ${EXPLICIT_BLOCK_THRESHOLD * 100}%`
                : `Blocked: Suggestive content ≥ ${SUGGESTIVE_BLOCK_THRESHOLD * 100}%`,
            moderation: labels,
            decision,
          });
          continue;
        }

        const ext = '.jpg';
        const base = removeSpacesAndDashes(
          path.basename(file.originalname, path.extname(file.originalname))
        ).toLowerCase();

        const key = `${env}/chat/${chatId}/${timestamp}/${index}-${base}${ext}`;

        await s3
          .putObject({
            Bucket: BUCKET,
            Key: key,
            Body: normalized,
            ContentType: 'image/jpeg',
            ACL: 'private',
          })
          .promise();

        file.mimetype = 'image/jpeg';
        file.transforms = [{ id: 'original', key }];
        file.moderation = labels;
        file.decision = decision;

        allowed.push(file);
      }

      // Only pass allowed files to the handler
      req.files = allowed;
      next();
    } catch (err) {
      next(err);
    }
  }

  // return both middlewares
  return [memory, processAndUpload];
};

module.exports = uploadMessageImage;
