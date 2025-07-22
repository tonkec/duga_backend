const { Notification} = require('../models');
const router = require('express').Router();
const { checkJwt } = require('../middleware/auth');
const attachCurrentUser = require("../middleware/attachCurrentUser");
const withAccessCheck = require('../middleware/accessCheck');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification operations
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get all notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count of notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Marked 5 notifications as read.
 *       400:
 *         description: Missing user ID
 *       500:
 *         description: Server error
 */
router.put('/mark-all-read', [checkJwt, attachCurrentUser], async (req, res) => {
  const userId = req.auth.user.id;
  

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

    return res.status(200).json({ message: `Marked ${updatedCount} notifications as read.` });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark as read', error });
  }
});

module.exports = router;