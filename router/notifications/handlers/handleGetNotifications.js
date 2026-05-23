const { Notification } = require('../../../models');

const handleGetNotifications = async (req, res) => {
  const userId = req.auth.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const where = { userId };
    if (req.query.unread === 'true') {
      where.isRead = false;
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    return res.status(200).json(notifications);
  } catch (err) {
    console.error('❌ Error fetching notifications:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = handleGetNotifications;
