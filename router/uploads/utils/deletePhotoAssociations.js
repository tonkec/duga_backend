const Upload = require('../../../models').Upload;
const PhotoComment = require('../../../models').PhotoComment;
const Message = require('../../../models').Message;
const s3 = require('../../../utils/s3');
const normalizeS3Key = require('../../../utils/normalizeS3Key');

const BUCKET = 'duga-user-photo';

const sameId = (left, right) => String(left) === String(right);

const findAllSafe = async (model, options) => {
  if (!model?.findAll) return [];
  return model.findAll(options);
};

const extractKeyFromUrl = (inputUrl) => {
  try {
    const u = new URL(inputUrl);
    return decodeURIComponent(u.pathname.slice(1));
  } catch {
    return inputUrl;
  }
};

const normalizeStoredS3Key = (url) => {
  const fullKey = String(extractKeyFromUrl(url) || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/^uploads\/files\//, '');
  const envPrefix = `${process.env.NODE_ENV}/`;

  return fullKey.startsWith(envPrefix) ? fullKey : `${envPrefix}${fullKey}`;
};

const getThumbnailKey = (s3Key) => {
  const lastSlashIndex = s3Key.lastIndexOf('/');
  const path = s3Key.substring(0, lastSlashIndex);
  const filename = s3Key.substring(lastSlashIndex + 1);

  return `${path}/thumbnail-${filename}`;
};

const deleteIfExists = async (Key) => {
  try {
    await s3.headObject({ Bucket: BUCKET, Key }).promise();
    await s3.deleteObject({ Bucket: BUCKET, Key }).promise();
    console.log(`✅ Deleted ${Key} from S3`);
  } catch (err) {
    if (err.code !== 'NotFound') {
      console.warn(`⚠️ Failed to delete ${Key}:`, err);
    } else {
      console.log(`ℹ️ Skipping deletion, ${Key} does not exist`);
    }
  }
};

const deletePhotoAndAssociations = async (authorizedUpload) => {
  if (!authorizedUpload?.url) {
    return [];
  }

  const s3Key = normalizeStoredS3Key(authorizedUpload.url);
  const normalizedKey = normalizeS3Key(s3Key);
  let deletedModels = [];

  const [uploadMatches, commentMatches, messageMatches] = await Promise.all([
    findAllSafe(Upload, { where: { url: s3Key } }),
    findAllSafe(PhotoComment, { where: { imageUrl: normalizedKey } }),
    findAllSafe(Message, { where: { messagePhotoUrl: s3Key } }),
  ]);

  const authorizedComments = commentMatches.filter((comment) =>
    sameId(comment.userId, authorizedUpload.userId)
  );
  const authorizedMessages = messageMatches.filter((message) =>
    sameId(message.fromUserId, authorizedUpload.userId)
  );
  const hasOtherReferences =
    uploadMatches.some((upload) => !sameId(upload.id, authorizedUpload.id)) ||
    commentMatches.length !== authorizedComments.length ||
    messageMatches.length !== authorizedMessages.length;

  if (authorizedUpload.destroy) {
    await authorizedUpload.destroy();
  }
  deletedModels.push('Upload');

  for (const match of authorizedComments) {
    if (match.setTaggedUsers) {
      await match.setTaggedUsers([]);
    }
    await match.destroy();
    deletedModels.push('PhotoComment');
  }

  for (const match of authorizedMessages) {
    await match.destroy();
    deletedModels.push('Message');
  }

  if (!hasOtherReferences) {
    await Promise.all([
      deleteIfExists(s3Key),
      deleteIfExists(getThumbnailKey(s3Key)),
    ]);
  }

  return deletedModels;
};

module.exports = deletePhotoAndAssociations;
