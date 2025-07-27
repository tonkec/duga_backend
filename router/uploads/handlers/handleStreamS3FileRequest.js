const streamS3File = require('../utils/streamS3File');

const handleStreamS3FileRequest = async (req, res) => {
  const rawKey = req.params[0];
  const key = decodeURIComponent(rawKey);

  try {
    await streamS3File(key, res);
  } catch (err) {
    console.error('🔥 S3 fetch failed:', err);
    res.status(500).json({ message: 'Unexpected server error' });
  }
};

module.exports = handleStreamS3FileRequest;
