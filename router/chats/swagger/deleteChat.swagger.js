/**
 * @swagger
 * /chats/{id}:
 *   delete:
 *     summary: Delete a chat. Group chats require admin membership.
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
 *         description: User is not a chat member or is not a group admin
 *       404:
 *         description: Chat not found
 */
