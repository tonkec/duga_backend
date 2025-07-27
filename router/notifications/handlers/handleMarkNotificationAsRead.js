const { Notification } = require('../../../models');

const handleMarkNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json(notification);
  } catch (err) {
    console.error('❌ Error marking notification as read:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = handleMarkNotificationAsRead;
