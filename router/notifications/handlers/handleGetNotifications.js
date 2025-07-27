const { Notification } = require('../../../models');

const handleGetNotifications = async (req, res) => {
  const userId = req.auth.user.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notifications = await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(notifications);
  } catch (err) {
    console.error('❌ Error fetching notifications:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = handleGetNotifications;
