const deletePhotoAndAssociations = require('./../utils/deletePhotoAssociations');

/**
 * Express handler for deleting a photo and its associations
 */
const handleDeletePhotoRequest = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Photo URL is required.' });
  }

  try {
    const deletedModels = await deletePhotoAndAssociations(url);

    if (deletedModels.length === 0) {
      return res.status(404).json({ error: 'No matching records found for this photo.' });
    }

    return res.status(200).json({
      message: `Photo and associated records (${[...new Set(deletedModels)].join(', ')}) deleted successfully.`,
    });
  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    return res.status(500).json({ error: 'Server error during deletion.' });
  }
};

module.exports = handleDeletePhotoRequest;
