/**
 * @swagger
 * /chats:
 *   get:
 *     summary: Get all chats for current user
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of chats. User objects include publicId. Recent messages can include mentionedUsers.
 */
