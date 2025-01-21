const Message = require('../models').Message;
const { auth } = require('../middleware/auth');
const router = require('express').Router();

router.post('/read-message', [auth], async (req, res) => {
  try {
      const message = await Message.findOne({
            where: {
                id: Number(req.body.id),
            },
      });
        
        if (!message) {
            return res.status(404).send({
                message: 'Message not found',
            });
        }
      message.is_read= true;
      await message.save();
      return res.status(200).send(message);
  } catch (error) {
        console.log(error);
        return res.status(500).send({
            message: 'Error occurred while reading message',
        });
  }
});

router.get("/is-read", [auth], async (req, res) => {
    try {
        if (!req.query.id) {
            return res.status(400).json({ message: "Message ID is required" });
        }
        const message = await Message.findOne({
            where: {
                id: Number(req.query.id),
            },
        });
    
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
    
        return res.status(200).json({ is_read: message.is_read });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
    });

module.exports = router;