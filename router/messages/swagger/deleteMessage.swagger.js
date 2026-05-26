/**
 * @swagger
 * /messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Message deleted
 *       403:
 *         description: Current user cannot delete this message
 *       404:
 *         description: Message not found
 */
