/**
 * @swagger
 * /chats/messages:
 *   get:
 *     summary: Get recent messages for the current user's chats
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of recent messages
 */