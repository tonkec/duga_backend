const removeSpacesAndDashes = require("./removeSpacesAndDashes");

const normalizeS3Key = (key) => {
  const envPrefix = `${process.env.NODE_ENV}/`;

  // Remove env prefix if it exists
  const cleanKey = key.startsWith(envPrefix) ? key.slice(envPrefix.length) : key;

  const lastSlashIndex = cleanKey.lastIndexOf('/');
  const path = cleanKey.substring(0, lastSlashIndex);
  const fileName = cleanKey.substring(lastSlashIndex + 1);

  // Lowercase and sanitize only the filename
  const normalizedFileName = removeSpacesAndDashes(fileName.toLowerCase());

  return `${path}/${normalizedFileName}`;
};

module.exports = normalizeS3Key;