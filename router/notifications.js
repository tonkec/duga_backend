const { Notification} = require('../models');
const router = require('express').Router();
const { checkJwt } = require('../middleware/auth');
const attachCurrentUser = require("../middleware/attachCurrentUser");
const withAccessCheck = require('../middleware/accessCheck');
const handleGetNotifications = require('./notifications/handlers/handleGetNotifications');
const handleMarkNotificationAsRead = require('./notifications/handlers/handleMarkNotificationAsRead');
const handleMarkAllNotificationsAsRead = require('./notifications/handlers/handleMarkAllNotificationsAsRead');

require('./notifications/swagger/getNotifications.swagger');
router.get('/', [checkJwt, attachCurrentUser], handleGetNotifications);

require('./notifications/swagger/markNotificationAsRead.swagger');
router.put(
  '/:id/read',
  [checkJwt, attachCurrentUser, withAccessCheck(Notification)],
  handleMarkNotificationAsRead
);

require('./notifications/swagger/markAllAsRead.swagger');
router.put(
  '/mark-all-read',
  [checkJwt, attachCurrentUser],
  handleMarkAllNotificationsAsRead
);


module.exports = router;