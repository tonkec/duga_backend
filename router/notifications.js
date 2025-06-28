const { Notification} = require('../models');
const router = require('express').Router();
const { checkJwt } = require('../middleware/auth');
const attachCurrentUser = require("../middleware/attachCurrentUser");
const withAccessCheck = require('../middleware/accessCheck');

router.get('/', [checkJwt, attachCurrentUser], async (req, res) => {
  const userId = req.auth.user.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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

router.put('/:id/read', [checkJwt, attachCurrentUser, withAccessCheck(Notification)], async (req, res) => {
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

router.put('/mark-all-read', [checkJwt, attachCurrentUser], async (req, res) => {
  const userId = req.auth.user.id;
  

  if (!userId) {
    return res.status(400).json({ message: 'Missing user ID' });
  }

  try {
    const [updatedCount] = await Notification.update(
      { is_read: true },
      {
        where: {
          userId,
          isRead: false,
        },
      }
    );

    return res.status(200).json({ message: `Marked ${updatedCount} notifications as read.` });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark as read', error });
  }
});

module.exports = router;