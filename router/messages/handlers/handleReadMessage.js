const handleReadMessage = async (req, res) => {
  try {
    const message = req.resource;

    message.is_read = true;
    await message.save();

    return res.status(200).send(message);
  } catch (error) {
    console.error('❌ Error reading message:', error);
    return res.status(500).send({
      message: 'Error occurred while reading message',
    });
  }
};

module.exports = handleReadMessage;
