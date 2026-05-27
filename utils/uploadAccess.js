const { Op } = require('sequelize');
const { Upload, UploadMention } = require('../models');

const getMentionedUploadIds = async (userId) => {
  if (!userId || !UploadMention?.findAll) return [];

  const mentions = await UploadMention.findAll({
    where: { userId },
    attributes: ['uploadId'],
  });

  return mentions.map((mention) => mention.uploadId).filter(Boolean);
};

const buildUploadAccessWhere = async (userId, extraWhere = {}) => {
  const mentionedUploadIds = await getMentionedUploadIds(userId);
  const accessConditions = [{ userId }];

  if (mentionedUploadIds.length > 0) {
    accessConditions.push({ id: { [Op.in]: mentionedUploadIds } });
  }

  return {
    ...extraWhere,
    [Op.or]: accessConditions,
  };
};

const findAccessibleUploadById = async (userId, uploadId, options = {}) => {
  if (!uploadId) return null;

  const where = await buildUploadAccessWhere(userId, { id: uploadId });

  return Upload.findOne({
    ...options,
    where,
  });
};

const hasUploadAccess = async (userId, uploadId) =>
  Boolean(
    await findAccessibleUploadById(userId, uploadId, { attributes: ['id'] })
  );

module.exports = {
  buildUploadAccessWhere,
  findAccessibleUploadById,
  hasUploadAccess,
};
