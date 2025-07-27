const Upload = require('../../../models').Upload;
const removeSpacesAndDashes = require('../../../utils/removeSpacesAndDashes');

const handleProfilePhotoUpload = async (req, res) => {
  try {
    const descriptions = JSON.parse(req.body.text);

    if (req.files.length) {
      await Promise.all(
        req.files.map(async (file) => {
          const match = descriptions.find(
            (d) => d.imageId === removeSpacesAndDashes(file.originalname)
          );
          await Upload.create({
            name: removeSpacesAndDashes(file.originalname),
            url: file.transforms[1].key,
            description: match?.description || null,
            userId: req.user.id,
          });
        })
      );
    } else {
      await Upload.update(
        { isProfilePhoto: false },
        { where: { userId: req.user.id } }
      );

      await Promise.all(
        descriptions.map(async (description) => {
          const [rowsUpdated] = await Upload.update(
            {
              description: description.description,
              isProfilePhoto: description.isProfilePhoto,
            },
            {
              where: {
                name: removeSpacesAndDashes(description.imageId),
                userId: req.user.id,
              },
            }
          );
          if (rowsUpdated === 0) {
            console.warn('⚠️ No records updated for', description.imageId);
          }
        })
      );
    }

    return res.status(200).json({ message: 'Upload successful' });
  } catch (e) {
    console.error('❌ Upload error:', e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports = handleProfilePhotoUpload;
