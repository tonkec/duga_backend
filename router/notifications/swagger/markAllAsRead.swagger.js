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