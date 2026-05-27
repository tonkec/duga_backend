const { Upload } = require('../models');
const removeSpacesAndDashes = require('./removeSpacesAndDashes');
const { extractKeyFromUrl } = require('./secureUploadUrl');

const unique = (values) => [...new Set(values.filter(Boolean))];

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const buildUploadKeyCandidates = (value) => {
  const env = process.env.NODE_ENV || 'development';
  const extractedKey = extractKeyFromUrl(value);
  const cleanKey = String(extractedKey || value || '')
    .trim()
    .replace(/^\/+/, '');
  const decodedKey = (() => {
    try {
      return decodeURIComponent(cleanKey);
    } catch (error) {
      return cleanKey;
    }
  })();
  const withoutFilesPrefix = decodedKey.replace(/^uploads\/files\//, '');
  const withoutEnv = withoutFilesPrefix.startsWith(`${env}/`)
    ? withoutFilesPrefix.slice(env.length + 1)
    : withoutFilesPrefix;
  const withEnv = withoutFilesPrefix.startsWith(`${env}/`)
    ? withoutFilesPrefix
    : `${env}/${withoutFilesPrefix}`;

  const candidates = unique([
    cleanKey,
    decodedKey,
    withoutFilesPrefix,
    withoutEnv,
    withEnv,
  ]);

  return unique([
    ...candidates,
    ...candidates.map((candidate) =>
      removeSpacesAndDashes(candidate.toLowerCase())
    ),
  ]);
};

const resolveMessagePhotoUrl = async ({ messagePhotoUrl, type, userId }) => {
  if (!messagePhotoUrl) return null;
  if (typeof messagePhotoUrl !== 'string' || !messagePhotoUrl.trim()) {
    const error = new Error('Invalid messagePhotoUrl');
    error.statusCode = 400;
    throw error;
  }

  const trimmedUrl = messagePhotoUrl.trim();
  if (type === 'gif' && isHttpUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  const upload = await Upload.findOne({
    where: {
      url: buildUploadKeyCandidates(trimmedUrl),
      userId,
    },
  });

  if (!upload) {
    const error = new Error('Invalid or inaccessible messagePhotoUrl');
    error.statusCode = 400;
    throw error;
  }

  return upload.url;
};

module.exports = {
  buildUploadKeyCandidates,
  resolveMessagePhotoUrl,
};
