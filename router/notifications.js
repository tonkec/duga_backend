const { Notification, User } = require('../models');
const router = require('express').Router();

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const notifications = await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
