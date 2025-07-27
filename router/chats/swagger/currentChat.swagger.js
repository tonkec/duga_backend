/**
 * @swagger
 * /chats/current-chat/{id}:
 *   get:
 *     summary: Get a specific chat with its messages and members
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Chat ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat details
 *       403:
 *         description: Forbidden or access denied
 */