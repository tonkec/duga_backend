const Upload = require('../../../models').Upload;
const { attachSecureUrl } = require('../../../utils/secureUploadUrl');
const getBearerToken = require('../../../utils/getBearerToken');
const { API_BASE_URL } = require('../../../consts/apiBaseUrl');

const handleMessagePhotoUpload = async (req, res) => {
  try {
    const rejectedFiles = req.rejectedFiles || [];

    // 1) Handle edge cases up front
    if ((!req.files || req.files.length === 0) && rejectedFiles.length > 0) {
      return res.status(400).json({
        message: 'All uploads were rejected',
        rejectedFiles,
        errors: [
          ...rejectedFiles.map(f => ({ fileName: f.originalname, reason: f.reason || 'Rejected' }))
        ]
      });
    }
    if (!req.files?.length) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // 2) Persist allowed files (unchanged logic)
    const accessToken = getBearerToken(req);
    const uploaded = await Promise.all(
      req.files.map(async (file) => {
        const key = file.transforms?.find((t) => t.id === 'original')?.key;
        const thumbnailKey = file.transforms?.find((t) => t.id === 'thumbnail')?.key;

        console.log('🧩 Uploading key:', key);

        if (!key) {
          throw { code: 'MISSING_KEY', message: 'Missing key in upload' };
        }

        const uploadRecord = await Upload.create({
          name: file.originalname,
          url: key,
          filetype: file.mimetype, 
          userId: req.auth.user.id,
        });

        return {
          id: uploadRecord.id,
          originalName: file.originalname,
          key,
          secureUrl: attachSecureUrl(API_BASE_URL, key, accessToken),
          thumbnailUrl: thumbnailKey
            ? attachSecureUrl(API_BASE_URL, thumbnailKey, accessToken)
            : null,
        };
      })
    );

    return res.status(200).json({
      message: 'Upload successful',
      files: uploaded,
      rejectedFiles, 
    });
  } catch (error) {
    if (error.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ message: error.message });
    }

    console.error('❌ Upload error:', error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = handleMessagePhotoUpload;
