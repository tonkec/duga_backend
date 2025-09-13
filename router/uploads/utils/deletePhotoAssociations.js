const Upload = require('../../../models').Upload;
const PhotoComment = require('../../../models').PhotoComment;
const Message = require('../../../models').Message;
const s3 = require('../../../utils/s3');
const removeSpacesAndDashes = require('./../../../utils/removeSpacesAndDashes');

const deletePhotoAndAssociations = async (url) => {
  const extractKeyFromUrl = (inputUrl) => {
    try {
      const u = new URL(inputUrl);
      return decodeURIComponent(u.pathname.slice(1));
    } catch {
      return inputUrl;
    }
  };

  const fullKey = extractKeyFromUrl(url);
  const envPrefix = `${process.env.NODE_ENV}/`;
  const key = fullKey.startsWith(envPrefix) ? fullKey.slice(envPrefix.length) : fullKey;
  const s3Key = `${process.env.NODE_ENV}/${key}`;
  const sanitizedKey = removeSpacesAndDashes(key);

  let deletedModels = [];

  // Uploads
  const uploadMatches = await Upload.findAll({ where: { url: s3Key } });
  for (const match of uploadMatches) {
    await match.destroy();
    deletedModels.push('Upload');
  }

  // PhotoComments
  const commentMatches = await PhotoComment.findAll({ where: { imageUrl: sanitizedKey } });
  for (const match of commentMatches) {
    await match.setTaggedUsers([]);
    await match.destroy();
    deletedModels.push('PhotoComment');
  }
  // Messages
  const messageMatches = await Message.findAll({ where: { messagePhotoUrl: `${process.env.NODE_ENV}/${sanitizedKey}` } });
  console.log(messageMatches, "MSG MATCHES")
  for (const match of messageMatches) {
    await match.destroy();
    deletedModels.push('Message');
  }

  console.log(deletedModels, "MODELS")

  // Delete original + thumbnail from S3
  const lastSlashIndex = key.lastIndexOf('/');
  const path = key.substring(0, lastSlashIndex);
  const filename = key.substring(lastSlashIndex + 1);
  const thumbnailKey = `${process.env.NODE_ENV}/${path}/thumbnail-${filename}`;

  const deleteIfExists = async (Key) => {
    try {
      await s3.headObject({ Bucket: 'duga-user-photo', Key }).promise();
      await s3.deleteObject({ Bucket: 'duga-user-photo', Key }).promise();
      console.log(`✅ Deleted ${Key} from S3`);
    } catch (err) {
      if (err.code !== 'NotFound') {
        console.warn(`⚠️ Failed to delete ${Key}:`, err);
      } else {
        console.log(`ℹ️ Skipping deletion, ${Key} does not exist`);
      }
    }
  };

  await Promise.all([deleteIfExists(s3Key), deleteIfExists(thumbnailKey)]);

  return deletedModels;
};

module.exports = deletePhotoAndAssociations