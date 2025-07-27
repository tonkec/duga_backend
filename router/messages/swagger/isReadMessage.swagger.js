/**
 * @swagger
 * /messages/is-read:
 *   get:
 *     summary: Check if a message is read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID of the message to check
 *     responses:
 *       200:
 *         description: Message read status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 is_read:
 *                   type: boolean
 *       403:
 *         description: Forbidden or unauthorized
 *       500:
 *         description: Server error
 */