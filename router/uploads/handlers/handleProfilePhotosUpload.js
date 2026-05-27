const s3 = require('../../../utils/s3');
const rekognition = require('../../../utils/rekognition');
const sharp = require('sharp');
const Upload = require('../../../models').Upload;
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');
const {
  BUCKET,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
} = require('../s3/rekognitionConfiguration');

const getTaggedUserIds = (description = {}) => {
  const taggedUserIds =
    description.taggedUserIds ?? description.taggedUsersIds ?? [];

  if (typeof taggedUserIds === 'string') {
    try {
      const parsed = JSON.parse(taggedUserIds);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return Array.isArray(taggedUserIds) ? taggedUserIds : [];
};

/** Normalize S3 key: trim & strip a leading slash only (no other mutations). */
function normalizeKey(k) {
  const s = String(k || '').trim();
  return s.startsWith('/') ? s.slice(1) : s;
}

/** Prefer transform with id==='original'; fall back to other transforms if needed. */
function pickTransformKey(file) {
  const original = file.transforms?.find?.((t) => t.id === 'original')?.key;
  if (original) return normalizeKey(original);
  if (file.transforms?.[1]?.key) return normalizeKey(file.transforms[1].key);
  if (file.transforms?.[0]?.key) return normalizeKey(file.transforms[0].key);
  return null;
}

async function headObjectOrThrow(Key) {
  await s3.headObject({ Bucket: BUCKET, Key }).promise(); // throws if missing
}

async function getObjectBytes(Key) {
  const obj = await s3.getObject({ Bucket: BUCKET, Key }).promise();
  if (!obj.Body) throw new Error('Empty S3 object body');

  if (Buffer.isBuffer(obj.Body)) {
    return obj.Body;
  }
  if (obj.Body instanceof Uint8Array) {
    return Buffer.from(obj.Body);
  }
  if (typeof obj.Body === 'string') {
    return Buffer.from(obj.Body);
  }
  if (typeof obj.Body.transformToByteArray === 'function') {
    return Buffer.from(await obj.Body.transformToByteArray());
  }
  if (typeof obj.Body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of obj.Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported S3 object body');
}

/** Convert anything to sane JPEG for Rekognition. */
async function toModerationJpeg(buffer) {
  return await sharp(buffer)
    .rotate() // honor EXIF orientation
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

  return (out.ModerationLabels || []).map((l) => ({
    name: l.Name,
    parent: l.ParentName || '',
    confidence: l.Confidence || 0,
  }));
}

function decide(labels) {
  const hasExplicit = labels.some(
    (l) =>
      (EXPLICIT_LABELS.has(l.name) || (l.name || '').includes('Sexual')) &&
      l.confidence >= EXPLICIT_BLOCK_THRESHOLD * 100
  );

  const hasSuggestive = labels.some(
    (l) =>
      (SUGGESTIVE_LABELS.has(l.name) || l.parent === 'Suggestive') &&
      l.confidence >= SUGGESTIVE_BLOCK_THRESHOLD * 100
  );

  return hasExplicit
    ? 'block-explicit'
    : hasSuggestive
      ? 'block-suggestive'
      : 'allow';
}

/** Delete all uploaded transforms for this file from S3 (used only when blocked or on error). */
async function deleteAllTransforms(file) {
  if (!file?.transforms?.length) return;
  await Promise.allSettled(
    file.transforms
      .filter((t) => t?.key)
      .map((t) =>
        s3.deleteObject({ Bucket: BUCKET, Key: normalizeKey(t.key) }).promise()
      )
  );
}

async function deleteUploadFromS3(upload) {
  if (!upload?.url) return;
  await s3
    .deleteObject({ Bucket: BUCKET, Key: normalizeKey(upload.url) })
    .promise();
}

const handleProfilePhotoUpload = async (req, res) => {
  try {
    const descriptions = req.body?.text ? JSON.parse(req.body.text) : [];

    // --- Case 1: files present → moderate each, delete from S3 if blocked, only persist allowed
    if (req.files?.length) {
      const rejectedFiles = [];
      let allowedCount = 0;

      await Promise.all(
        req.files.map(async (file) => {
          const key = pickTransformKey(file);
          if (!key) {
            rejectedFiles.push({
              name: file.originalname,
              reason: 'No transform key found',
            });
            return;
          }

          try {
            // 1) Ensure object exists and fetch bytes
            await headObjectOrThrow(key);
            const rawBytes = await getObjectBytes(key);

            // 2) Normalize to JPEG for Rekognition (prevents InvalidImageFormatException)
            const jpegBytes = await toModerationJpeg(rawBytes);

            // 3) Moderate + decide
            const labels = await detectModerationByBytes(jpegBytes);
            const decision = decide(labels);
            console.log('🔎 moderation labels:', labels);
            console.log('🔎 decision:', decision, 'for', key);

            if (decision !== 'allow') {
              // Delete from S3 ONLY when blocked
              await deleteAllTransforms(file);

              rejectedFiles.push({
                name: file.originalname,
                reason:
                  decision === 'block-explicit'
                    ? `Blocked: Explicit content ≥ ${EXPLICIT_BLOCK_THRESHOLD * 100}%`
                    : `Blocked: Suggestive content ≥ ${SUGGESTIVE_BLOCK_THRESHOLD * 100}%`,
                labels,
              });
              return; // skip DB insert
            }

            // 4) Allowed → create Upload row
            const match = descriptions.find(
              (d) => d.imageId === removeSpacesAndDashes(file.originalname)
            );
            const isProfilePhoto = Boolean(match?.isProfilePhoto);

            if (isProfilePhoto) {
              const oldProfilePhoto = await Upload.findOne({
                where: {
                  userId: req.user.id,
                  isProfilePhoto: true,
                },
                order: [['createdAt', 'DESC']],
              });

              if (oldProfilePhoto) {
                await deleteUploadFromS3(oldProfilePhoto);
                await oldProfilePhoto.destroy();
              }

              await Upload.update(
                { isProfilePhoto: false },
                { where: { userId: req.user.id } }
              );
            }

            const upload = await Upload.create({
              name: removeSpacesAndDashes(file.originalname),
              url: key, // store exact S3 key for later streaming
              description: match?.description || null,
              userId: req.user.id,
              isProfilePhoto,
            });
            const taggedUserIds = getTaggedUserIds(match);
            if (taggedUserIds.length && upload.setTaggedUsers) {
              await upload.setTaggedUsers(taggedUserIds);
            }

            allowedCount += 1;
          } catch (err) {
            console.error('❌ Moderation flow error for key:', key, err);
            // Treat as reject to be safe; also attempt cleanup
            await deleteAllTransforms(file).catch(() => {});
            rejectedFiles.push({
              name: file.originalname,
              reason: 'Unable to validate image content',
              detail: err.code || err.message,
            });
          }
        })
      );

      // --- Status code semantics ---
      if (allowedCount === 0 && rejectedFiles.length > 0) {
        // Everything was rejected → 422
        return res.status(422).json({
          message: 'All images were rejected by moderation.',
          errors: rejectedFiles.map((r) => ({
            reason: r.reason,
            name: r.name,
          })),
          rejectedFiles,
        });
      }

      // Mixed or all allowed → 200
      return res.status(200).json({
        message: rejectedFiles.length
          ? 'Upload processed (some images were rejected).'
          : 'Upload successful',
        partial: rejectedFiles.length > 0,
        rejectedFiles,
      });
    }

    // --- Case 2: no files → update descriptions / profile photo flag (original behavior)
    await Upload.update(
      { isProfilePhoto: false },
      { where: { userId: req.user.id } }
    );

    await Promise.all(
      (descriptions || []).map(async (description) => {
        const name = removeSpacesAndDashes(description.imageId);
        const [rowsUpdated] = await Upload.update(
          {
            description: description.description,
            isProfilePhoto: description.isProfilePhoto,
          },
          {
            where: {
              name,
              userId: req.user.id,
            },
          }
        );
        const taggedUserIds = getTaggedUserIds(description);
        const upload = await Upload.findOne({
          where: {
            name,
            userId: req.user.id,
          },
        });
        if (upload?.setTaggedUsers) {
          await upload.setTaggedUsers(taggedUserIds);
        }
        if (rowsUpdated === 0) {
          console.warn('⚠️ No records updated for', description.imageId);
        }
      })
    );

    return res.status(200).json({ message: 'Update successful' });
  } catch (e) {
    console.error('❌ Upload error:', e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports = handleProfilePhotoUpload;
