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
 *               partnerId:
 *                 type: number
 *                 description: User ID for one-on-one chats
 *               userIds:
 *                 type: array
 *                 description: User IDs for group chats. The current user is added automatically. Groups can have up to 50 total members.
 *                 maxItems: 49
 *                 items:
 *                   type: number
 *               name:
 *                 type: string
 *                 description: Optional group chat name
 *     responses:
 *       201:
 *         description: Chat created successfully
 */
