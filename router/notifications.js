const { Notification } = require('../models');
const router = require('express').Router();
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const handleGetNotifications = require('./notifications/handlers/handleGetNotifications');
const handleMarkNotificationAsRead = require('./notifications/handlers/handleMarkNotificationAsRead');
const handleMarkAllNotificationsAsRead = require('./notifications/handlers/handleMarkAllNotificationsAsRead');
const handleDeleteNotification = require('./notifications/handlers/handleDeleteNotification');

require('./notifications/swagger/getNotifications.swagger');
router.get('/', authenticatedAppSession, handleGetNotifications);

require('./notifications/swagger/markNotificationAsRead.swagger');
router.put(
  '/:id/read',
  [...authenticatedAppSession, withAccessCheck(Notification)],
  handleMarkNotificationAsRead
);

require('./notifications/swagger/markAllAsRead.swagger');
router.put(
  '/mark-all-read',
  authenticatedAppSession,
  handleMarkAllNotificationsAsRead
);

router.delete(
  '/:id',
  [...authenticatedAppSession, withAccessCheck(Notification)],
  handleDeleteNotification
);

module.exports = router;
