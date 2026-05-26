/**
 * @swagger
 * /chats/messages:
 *   get:
 *     summary: Get messages for a chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         description: Chat ID
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: number
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated messages. Each message can include mentionedUsers with id, publicId, username, and avatar.
 *       400:
 *         description: Invalid or missing chatId
 *       403:
 *         description: Current user is not a member of the chat
 */
