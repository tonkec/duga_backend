const handleGetIsReadMessage = async (req, res) => {
  try {
    const message = req.resource;

    return res.status(200).json({ is_read: message.is_read });
  } catch (error) {
    console.error('❌ Error checking message read status:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = handleGetIsReadMessage;