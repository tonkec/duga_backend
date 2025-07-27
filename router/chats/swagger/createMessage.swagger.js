/**
 * @swagger
 * /chats/create:
 *   post:
 *     summary: Create a new chat (direct or group)
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: number
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat created successfully
 */