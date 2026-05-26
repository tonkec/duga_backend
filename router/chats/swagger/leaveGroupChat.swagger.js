/**
 * @swagger
 * /chats/{id}/leave:
 *   post:
 *     summary: Leave a group chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Group chat ID
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: User left the group chat
 *       400:
 *         description: Invalid chat ID or not a group chat
 *       403:
 *         description: Current user is not a member of the chat
 *       404:
 *         description: Chat not found
 */
