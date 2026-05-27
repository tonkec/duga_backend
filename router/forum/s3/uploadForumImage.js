const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const AWS = require('aws-sdk');
const s3 = require('../../../utils/s3');
const allowedMimeTypes = require('../../../consts/allowedFileTypes');
const LIMIT_FILE_SIZE = require('../../../consts/limitFileSize');
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const {
  SVG_CONTENT_TYPE,
  isSvgFile,
  sanitizeSvg,
} = require('../../../utils/svgSecurity');
const {
  BUCKET,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
} = require('../../uploads/s3/rekognitionConfiguration');

const rekognition = new AWS.Rekognition();
const FORUM_IMAGE_FIELDS = [
  { name: 'image', maxCount: 1 },
  { name: 'questionImage', maxCount: 1 },
  { name: 'answerImage', maxCount: 1 },
];

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMIT_FILE_SIZE, files: 1 },
  fileFilter(req, file, cb) {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    const error = new Error(
      'Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.'
    );
    error.code = 'INVALID_FILE_TYPE';
    cb(error);
  },
}).fields(FORUM_IMAGE_FIELDS);

const getFirstUploadedFile = (files = {}) =>
  FORUM_IMAGE_FIELDS.map(({ name }) => files[name]?.[0]).find(Boolean);

const decideModeration = (labels) => {
  const hasExplicit = labels.some(
    (label) =>
      (EXPLICIT_LABELS.has(label.Name) ||
        (label.Name || '').includes('Sexual')) &&
      label.Confidence >= EXPLICIT_BLOCK_THRESHOLD * 100
  );

  const hasSuggestive = labels.some(
    (label) =>
      (SUGGESTIVE_LABELS.has(label.Name) ||
        label.ParentName === 'Suggestive') &&
      label.Confidence >= SUGGESTIVE_BLOCK_THRESHOLD * 100
  );

  return hasExplicit
    ? 'block-explicit'
    : hasSuggestive
      ? 'block-suggestive'
      : 'allow';
};

const uploadForumImage = (target) => [
  (req, res, next) => {
    memoryUpload(req, res, (err) => {
      if (!err) {
        next();
        return;
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          errors: [
            {
              reason: `Datoteka je veća od ${LIMIT_FILE_SIZE / (1024 * 1024)} MB.`,
            },
          ],
        });
      }

      if (
        err.code === 'LIMIT_FILE_COUNT' ||
        err.code === 'LIMIT_UNEXPECTED_FILE'
      ) {
        return res
          .status(413)
          .json({ errors: [{ reason: 'Nepodržan format' }] });
      }

      return res.status(400).json({ message: err.message || 'Upload error.' });
    });
  },
  async (req, res, next) => {
    try {
      const file = getFirstUploadedFile(req.files);
      if (!file) {
        return next();
      }

      const isSvg = isSvgFile(file);
      const uploadBody = isSvg ? sanitizeSvg(file.buffer) : file.buffer;
      const normalized = await sharp(uploadBody)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      const moderation = await rekognition
        .detectModerationLabels({
          Image: { Bytes: normalized },
          MinConfidence: 60,
        })
        .promise();
      const labels = moderation.ModerationLabels || [];
      const decision = decideModeration(labels);

      if (decision !== 'allow') {
        return res.status(422).json({
          message: 'Forum image rejected by moderation',
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

      const env = process.env.NODE_ENV || 'development';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const base = removeSpacesAndDashes(
        path.basename(file.originalname, ext).toLowerCase().trim()
      );
      const storedExt = isSvg ? '.svg' : '.jpg';
      const contentType = isSvg ? SVG_CONTENT_TYPE : 'image/jpeg';
      const key = `${env}/forum/${target}/${req.auth.user.id}/${Date.now()}/${base}${storedExt}`;

      await s3
        .putObject({
          Bucket: BUCKET,
          Key: key,
          Body: isSvg ? uploadBody : normalized,
          ContentType: contentType,
          ACL: 'private',
        })
        .promise();

      req.forumImage = {
        key,
        name: `${base}${ext}`,
        mimetype: contentType,
        moderation: labels,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  },
];

module.exports = uploadForumImage;
