const handleDeleteNotification = async (req, res) => {
  try {
    const notification = req.resource;

    await notification.destroy();

    return res.status(200).json({ id: Number(req.params.id) });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
};

module.exports = handleDeleteNotification;
