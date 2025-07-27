/**
 * @swagger
 * /chats/{id}:
 *   delete:
 *     summary: Delete a chat (admin or owner only)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 *       403:
 *         description: Forbidden
 */