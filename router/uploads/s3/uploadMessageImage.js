const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const removeSpacesAndDashes = require("../../../utils/removeSpacesAndDashes");
const AWS = require('aws-sdk'); // v2
const { MAX_NUMBER_OF_FILES } = require('../../../consts/maxNumberOfFiles');

const BUCKET = 'duga-user-photo';
const FIELD_NAME = 'avatars';
const MAX_FILE_MB = 15;

// --- Policy thresholds (tune as needed) ---
// --- Policy thresholds ---
const EXPLICIT_BLOCK_THRESHOLD = Number(process.env.EXPLICIT_BLOCK_THRESHOLD ?? 0.90);  // 90%
const SUGGESTIVE_BLOCK_THRESHOLD = Number(process.env.SUGGESTIVE_BLOCK_THRESHOLD ?? 0.75); // 75%

// Labels to block as explicit
const EXPLICIT_LABELS = new Set([
  'Explicit Nudity',
  'Sexual Activity',
  'Sexual Situations',
  'Non-Explicit Nudity',
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Partially Exposed Female Breast',
]);

// Labels to block as suggestive
const SUGGESTIVE_LABELS = new Set([
  'Suggestive',
  'Revealing Clothes',
  'Implied Nudity',
  'Swimwear or Underwear',
  'Female Swimwear or Underwear',
]);

// Build Rekognition v2 from the SAME AWS config/creds as your S3 client
const rekognition = new AWS.Rekognition();

const uploadMessageImage = (s3 ) => {
  if (!s3 || typeof s3.putObject !== 'function') {
    throw new Error('Expected an AWS SDK v2 S3 client');
  }

  // 1) Buffer files in memory (no S3 yet)
  const memory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_NUMBER_OF_FILES },
    fileFilter(req, file, cb) {
      if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
      const err = new Error('Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      cb(err);
    },
  }).array(FIELD_NAME, MAX_NUMBER_OF_FILES);

  // 2) Moderate -> upload allowed -> mimic transforms
  async function processAndUpload(req, res, next) {
    try {
      req.rejectedFiles = [];
      if (!req.files?.length) return next();

      const body = JSON.parse(JSON.stringify(req.body));
      const env = process.env.NODE_ENV || 'development';

      const allowed = [];
      for (const file of req.files) {
        // Normalize/resize (strip EXIF); store as JPEG
        const normalized = await sharp(file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer();

        // Rekognition moderation (v2)
        const mod = await rekognition.detectModerationLabels({
          Image: { Bytes: normalized },
          MinConfidence: 60,
        }).promise();

        const rawLabels = mod.ModerationLabels || [];
        const labels = rawLabels.map(l => ({
          name: l.Name,
          parent: l.ParentName,
          confidence: l.Confidence || 0
        }));

        // ---- Decision logic ----
        const hasExplicit = labels.some(l =>
          (EXPLICIT_LABELS.has(l.name) || (l.name || '').includes('Sexual')) &&
          l.confidence >= EXPLICIT_BLOCK_THRESHOLD * 100
        );

        const hasSuggestive = labels.some(l =>
          (SUGGESTIVE_LABELS.has(l.name) || l.parent === 'Suggestive') &&
          l.confidence >= SUGGESTIVE_BLOCK_THRESHOLD * 100
        );

        const decision = hasExplicit ? 'block-explicit' : (hasSuggestive ? 'block-suggestive' : 'allow');

        // Helpful logs while tuning
        console.log('🔎 moderation labels:', labels);
        console.log('🔎 decision:', decision);

        if (decision !== 'allow') {
          req.rejectedFiles.push({
            originalName: file.originalname,
            reason: decision === 'block-explicit'
              ? `Blocked: Explicit content ≥ ${EXPLICIT_BLOCK_THRESHOLD * 100}%`
              : `Blocked: Suggestive content ≥ ${SUGGESTIVE_BLOCK_THRESHOLD * 100}%`,
            moderation: labels,
            decision,
          });
          continue; // DO NOT upload
        }

        // ---- Allowed → build key & upload ----
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const base = removeSpacesAndDashes(path.basename(file.originalname, ext)).toLowerCase();

        // keep your existing env prefix (or drop env if you’ve standardized without it)
        const key = `${env}/chat/${body.chatId}/${body.timestamp}/${base}${ext}`;

        await s3.putObject({
          Bucket: BUCKET,
          Key: key,
          Body: normalized,
          ContentType: 'image/jpeg', // stored as JPEG even if key ends with .png
          ACL: 'private',
        }).promise();

        // Mimic multer-s3-transform shape so your handler works unchanged
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
