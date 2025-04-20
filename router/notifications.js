const { Notification} = require('../models');
const router = require('express').Router();
const { checkJwt } = require('../middleware/auth');


router.get('/:userId', [checkJwt],async (req, res) => {
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

router.put('/:id/read', [checkJwt], async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
