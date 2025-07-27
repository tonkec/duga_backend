const { Notification } = require('../../../models');

const handleMarkAllNotificationsAsRead = async (req, res) => {
  const userId = req.auth?.user?.id;

  if (!userId) {
    return res.status(400).json({ message: 'Missing user ID' });
  }

  try {
    const [updatedCount] = await Notification.update(
      { isRead: true },
      {
        where: {
          userId,
          isRead: false,
        },
      }
    );

    return res
      .status(200)
      .json({ message: `Marked ${updatedCount} notifications as read.` });
  } catch (error) {
    console.error('❌ Failed to mark notifications as read:', error);
    return res.status(500).json({ message: 'Failed to mark as read', error });
  }
};

module.exports = handleMarkAllNotificationsAsRead;
